import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { checkEvmBalance, checkSvmBalance } from "~/lib/balance.js";
import { getChainMeta } from "~/lib/chains.js";
import { env } from "~/lib/env.js";
import { normalisePrivateKey, parseEvmCaip10 } from "~/lib/evm.js";
import { listWallets } from "~/lib/keystore.js";
import { DEFAULT_SVM_RPC } from "~/lib/svm.js";
import { startSessionServer } from "~/server/index.js";
import { type ActiveWallet, activeWallets, createWalletSession } from "~/server/wallet-sessions.js";

export type ChainType = "evm" | "svm";

/** Thin descriptor of the tx payload needed for balance checks */
export type TxContext =
  | { type: "evm"; caip10To: string; gasLimit: number; rpcUrl?: string }
  | { type: "svm"; rpcUrl?: string };

export type WalletResolution =
  | { kind: "ready"; privateKey: string; address: string }
  | {
      kind: "browser_required";
      action: "unlock" | "provide" | "new";
      url: string;
      newWallet?: { address: string; chain: string; symbol: string };
    }
  | {
      kind: "insufficient_funds";
      address: string;
      balance: string;
      required: string;
      symbol: string;
      chain: string;
    }
  | { kind: "declined" }
  | { kind: "error"; message: string };

function chainTypeFromCaip2(caip2: string): ChainType {
  return caip2.startsWith("solana:") ? "svm" : "evm";
}

function deriveAddress(privateKey: string, type: ChainType): string {
  if (type === "evm") return privateKeyToAccount(normalisePrivateKey(privateKey)).address;
  return Keypair.fromSecretKey(bs58.decode(privateKey)).publicKey.toBase58();
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
    symbol: type === "evm" ? "ETH" : "SOL",
  };
  if (type === "evm" && ctx.type === "evm") {
    const { chainId } = parseEvmCaip10(ctx.caip10To);
    const r = await checkEvmBalance(address, chainId, ctx.gasLimit, ctx.rpcUrl);
    if (r.isErr()) return fallback;
    return {
      sufficient: r.value.sufficient,
      balance: r.value.balanceFormatted,
      required: r.value.requiredFormatted,
      symbol: r.value.symbol,
    };
  }
  const rpc = ctx.type === "svm" ? ctx.rpcUrl : DEFAULT_SVM_RPC;
  const r = await checkSvmBalance(address, rpc);
  if (r.isErr()) return fallback;
  return {
    sufficient: r.value.sufficient,
    balance: r.value.balanceFormatted,
    required: r.value.requiredFormatted,
    symbol: r.value.symbol,
  };
}

async function browserUrl(action: "unlock" | "provide" | "new", token: string): Promise<string> {
  const port = await startSessionServer();
  const api = encodeURIComponent(`http://localhost:${port}`);
  return `http://localhost:${port}/wallet/${action}?token=${token}&api=${api}`;
}

type ElicitServer = {
  server: {
    elicitInput: (opts: unknown) => Promise<{ action: string; content?: { choice: string } }>;
  };
};

async function elicitChoice(
  server: McpServer,
  message: string,
  choices: string[],
): Promise<string | null> {
  try {
    const result = await (server as unknown as ElicitServer).server.elicitInput({
      mode: "form",
      message,
      requestedSchema: {
        type: "object",
        properties: { choice: { type: "string", title: "Wallet", enum: choices } },
        required: ["choice"],
      },
    });
    return result.action === "accept" && result.content ? result.content.choice : null;
  } catch {
    return null;
  }
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

async function handleActiveChoice(
  active: ActiveWallet,
  chainName: string,
  type: ChainType,
  ctx: TxContext,
): Promise<WalletResolution> {
  const bal = await checkBalance(active.address, type, ctx);
  return bal.sufficient
    ? { kind: "ready", privateKey: active.privateKey, address: active.address }
    : { kind: "insufficient_funds", address: active.address, chain: chainName, ...bal };
}

async function handleStoredChoice(
  walletId: string,
  address: string,
  caip2: string,
): Promise<WalletResolution> {
  const token = createWalletSession({ action: "unlock", chain: caip2, walletId, address }).token;
  return { kind: "browser_required", action: "unlock", url: await browserUrl("unlock", token) };
}

async function handleProvideChoice(caip2: string): Promise<WalletResolution> {
  const token = createWalletSession({ action: "provide", chain: caip2 }).token;
  return { kind: "browser_required", action: "provide", url: await browserUrl("provide", token) };
}

async function handleGenerateChoice(
  type: ChainType,
  caip2: string,
  chainName: string,
  symbol: string,
): Promise<WalletResolution> {
  let privateKey: string;
  let address: string;
  if (type === "evm") {
    privateKey = generatePrivateKey();
    address = privateKeyToAccount(normalisePrivateKey(privateKey)).address;
  } else {
    const kp = Keypair.generate();
    privateKey = bs58.encode(kp.secretKey);
    address = kp.publicKey.toBase58();
  }
  const token = createWalletSession({
    action: "new",
    chain: caip2,
    address,
    privateKeyTemp: privateKey,
  }).token;
  return {
    kind: "browser_required",
    action: "new",
    url: await browserUrl("new", token),
    newWallet: { address, chain: chainName, symbol },
  };
}

/**
 * Resolve a private key for signing, prompting the user via MCP elicitation when needed.
 *
 * - In AGENT_MODE: uses env vars only, no elicitation.
 * - Otherwise: always elicits to let the user choose or provision a wallet.
 *
 * When browser interaction is needed, returns `browser_required` with a URL to present
 * to the user. The key will be in `activeWallets` after the flow completes; re-invoke
 * the sign tool and the active wallet will be offered automatically.
 */
export async function resolveWallet(
  server: McpServer,
  caip2: string,
  ctx: TxContext,
): Promise<WalletResolution> {
  const type = chainTypeFromCaip2(caip2);
  const meta = getChainMeta(caip2);
  const chainName = meta?.name ?? caip2;

  if (env.AGENT_MODE === "1" || env.AGENT_MODE === "true") {
    return resolveAgentMode(type, chainName, ctx);
  }

  const active = activeWallets.get(type);
  const stored = listWallets(caip2);

  const choices: string[] = [];
  if (active) choices.push(`Use active wallet — ${active.address}`);
  for (const w of stored) choices.push(`${w.label} — ${w.address}`);
  choices.push("Provide a key");
  choices.push("Generate new wallet");

  const message =
    active || stored.length > 0
      ? `Choose a wallet to sign on ${chainName}:`
      : `No wallets configured for ${chainName}. How would you like to sign?`;

  const choice = await elicitChoice(server, message, choices);
  if (!choice) return { kind: "declined" };

  if (active && choice === `Use active wallet — ${active.address}`) {
    return handleActiveChoice(active, chainName, type, ctx);
  }

  const matchedStored = stored.find((w) => choice === `${w.label} — ${w.address}`);
  if (matchedStored) return handleStoredChoice(matchedStored.id, matchedStored.address, caip2);

  if (choice === "Provide a key") return handleProvideChoice(caip2);
  if (choice === "Generate new wallet")
    return handleGenerateChoice(type, caip2, chainName, meta?.symbol ?? "tokens");

  return { kind: "error", message: "Unrecognised wallet choice." };
}
