import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type ChainType,
  chainTypeFromCaip2,
  checkEvmBalance,
  checkSvmBalance,
  getChainMeta,
  normalisePrivateKey,
  parseEvmCaip10,
} from "@printr/sdk";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { match } from "ts-pattern";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "~/lib/env.js";
import { type ActiveWallet, activeWallets } from "~/server/wallet-sessions.js";

export type { ActiveWallet, ChainType };

/** Thin descriptor of the tx payload needed for balance checks */
export type TxContext =
  | { type: "evm"; caip10To: string; gasLimit: number; rpcUrl?: string | undefined }
  | { type: "svm"; rpcUrl?: string | undefined };

export type WalletResolution =
  | { kind: "ready"; privateKey: string; address: string }
  | {
      kind: "insufficient_funds";
      address: string;
      balance: string;
      required: string;
      symbol: string;
      chain: string;
    }
  | { kind: "error"; message: string };

function deriveAddress(privateKey: string, type: ChainType): string {
  return match(type)
    .with("evm", () => privateKeyToAccount(normalisePrivateKey(privateKey)).address)
    .with("svm", () => Keypair.fromSecretKey(bs58.decode(privateKey)).publicKey.toBase58())
    .exhaustive();
}

type BalanceSummary = { sufficient: boolean; balance: string; required: string; symbol: string };

async function checkBalance(
  address: string,
  type: ChainType,
  ctx: TxContext,
): Promise<BalanceSummary> {
  const fallback: BalanceSummary = {
    sufficient: true,
    balance: "?",
    required: "?",
    symbol: match(type)
      .with("evm", () => "ETH")
      .with("svm", () => "SOL")
      .exhaustive(),
  };
  if (type === "evm" && ctx.type === "evm") {
    const { chainId } = parseEvmCaip10(ctx.caip10To);
    return (await checkEvmBalance(address, chainId, ctx.gasLimit, ctx.rpcUrl)).match(
      (r) => ({
        sufficient: r.sufficient,
        balance: r.balanceFormatted,
        required: r.requiredFormatted,
        symbol: r.symbol,
      }),
      () => fallback,
    );
  }
  return (await checkSvmBalance(address, ctx.type === "svm" ? ctx.rpcUrl : undefined)).match(
    (r) => ({
      sufficient: r.sufficient,
      balance: r.balanceFormatted,
      required: r.requiredFormatted,
      symbol: r.symbol,
    }),
    () => fallback,
  );
}

async function resolveAgentMode(
  type: ChainType,
  chainName: string,
  ctx: TxContext,
): Promise<WalletResolution> {
  const key = type === "evm" ? env.EVM_WALLET_PRIVATE_KEY : env.SVM_WALLET_PRIVATE_KEY;
  if (!key) {
    return {
      kind: "error",
      message: `No wallet configured. In AGENT_MODE, set ${type === "evm" ? "EVM" : "SVM"}_WALLET_PRIVATE_KEY or pass private_key in the tool call.`,
    };
  }
  const address = deriveAddress(key, type);
  const bal = await checkBalance(address, type, ctx);
  return bal.sufficient
    ? { kind: "ready", privateKey: key, address }
    : { kind: "insufficient_funds", address, chain: chainName, ...bal };
}

export function insufficientFundsMessage(
  r: Extract<WalletResolution, { kind: "insufficient_funds" }>,
): string {
  return (
    `Wallet ${r.address} on ${r.chain} has insufficient ${r.symbol}.\n` +
    `Balance:  ${r.balance} ${r.symbol}\n` +
    `Required: ${r.required} ${r.symbol}\n\nFund the wallet and try again.`
  );
}

/**
 * Resolve a private key for signing.
 *
 * - In AGENT_MODE: uses env vars only.
 * - Otherwise: checks activeWallets (set by printr_wallet_unlock / printr_wallet_new /
 *   printr_wallet_import). If no active wallet, returns an error directing the user to
 *   call the appropriate wallet tool.
 */
export async function resolveWallet(
  _server: McpServer,
  caip2: string,
  ctx: TxContext,
): Promise<WalletResolution> {
  const chainType = chainTypeFromCaip2(caip2);
  const meta = getChainMeta(caip2);
  const chainName = meta?.name ?? caip2;

  if (env.AGENT_MODE === "1" || env.AGENT_MODE === "true") {
    return resolveAgentMode(chainType, chainName, ctx);
  }

  const active = activeWallets.get(chainType);
  if (active) {
    const bal = await checkBalance(active.address, chainType, ctx);
    return bal.sufficient
      ? { kind: "ready", privateKey: active.privateKey, address: active.address }
      : { kind: "insufficient_funds", address: active.address, chain: chainName, ...bal };
  }

  return {
    kind: "error",
    message:
      `No active ${chainType.toUpperCase()} wallet. ` +
      `Call \`printr_wallet_unlock\` to unlock a stored wallet, or ` +
      `\`printr_wallet_new\` / \`printr_wallet_import\` to add one.`,
  };
}
