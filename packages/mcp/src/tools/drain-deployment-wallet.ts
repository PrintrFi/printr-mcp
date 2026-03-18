import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type ChainMeta,
  type ChainType,
  chainTypeFromCaip2,
  clearActiveWalletId,
  clearLastDeploymentWalletId,
  decryptKey,
  getActiveWalletId,
  getChainMeta,
  getLastDeploymentWalletId,
  getRpcUrl,
  getSvmRpcUrl,
  getWallet,
  logger,
  normalisePrivateKey,
  parseCaip2,
  sendAndConfirmSvmTransaction,
  toolError,
  toolOk,
} from "@printr/sdk";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { err, ok, type Result } from "neverthrow";
import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { env } from "~/lib/env.js";
import { getTreasuryKeyOrError } from "~/lib/treasury.js";
import { activeWallets } from "~/server/wallet-sessions.js";

type DrainError = { message: string };

type ResolvedWallet = { privateKey: string; address: string; walletId: string };

function getDeploymentPassword(): Result<string, DrainError> {
  const password = env.PRINTR_DEPLOYMENT_PASSWORD;
  if (!password) {
    return err({
      message:
        "PRINTR_DEPLOYMENT_PASSWORD environment variable is required to decrypt deployment wallets. " +
        "This is the same password used when creating deployment wallets.",
    });
  }
  return ok(password);
}

function resolveWallet(type: ChainType, walletId?: string): Result<ResolvedWallet, DrainError> {
  // Priority 1: Explicit wallet_id parameter
  if (walletId) {
    return getDeploymentPassword().andThen((password) => {
      const entry = getWallet(walletId);
      if (!entry) {
        return err({ message: `Wallet not found in keystore: ${walletId}` });
      }
      return decryptKey(entry, password)
        .map((privateKey) => ({ privateKey, address: entry.address, walletId: entry.id }))
        .mapErr(
          () =>
            ({
              message:
                "Failed to decrypt wallet. Check that PRINTR_DEPLOYMENT_PASSWORD matches " +
                "the password used when the wallet was created.",
            }) as DrainError,
        );
    });
  }

  // Priority 2: In-memory active wallet (current session)
  const memoryWallet = activeWallets.get(type);
  if (memoryWallet) {
    const activeId = getActiveWalletId(type);
    return ok({
      privateKey: memoryWallet.privateKey,
      address: memoryWallet.address,
      walletId: activeId ?? "unknown",
    });
  }

  // Priority 3: Persisted active wallet ID (after restart recovery)
  const persistedActiveId = getActiveWalletId(type);
  if (persistedActiveId) {
    return getDeploymentPassword().andThen((password) => {
      const entry = getWallet(persistedActiveId);
      if (!entry) {
        return err({
          message:
            `Previously active wallet ${persistedActiveId} not found in keystore. ` +
            "It may have been removed.",
        });
      }
      return decryptKey(entry, password)
        .map((privateKey) => ({ privateKey, address: entry.address, walletId: entry.id }))
        .mapErr(
          () =>
            ({
              message:
                "Failed to decrypt previously active wallet. Check PRINTR_DEPLOYMENT_PASSWORD.",
            }) as DrainError,
        );
    });
  }

  // Priority 4: Last deployment wallet ID (fallback recovery)
  const lastDeploymentId = getLastDeploymentWalletId();
  if (lastDeploymentId) {
    return getDeploymentPassword().andThen((password) => {
      const entry = getWallet(lastDeploymentId);
      if (!entry) {
        return err({
          message:
            `Last deployment wallet ${lastDeploymentId} not found in keystore. ` +
            "It may have been removed.",
        });
      }
      return decryptKey(entry, password)
        .map((privateKey) => ({ privateKey, address: entry.address, walletId: entry.id }))
        .mapErr(
          () =>
            ({
              message:
                "Failed to decrypt last deployment wallet. Check PRINTR_DEPLOYMENT_PASSWORD.",
            }) as DrainError,
        );
    });
  }

  return err({
    message:
      `No active ${type.toUpperCase()} deployment wallet found. ` +
      "Either call printr_fund_deployment_wallet first, or provide wallet_id explicitly.",
  });
}

type EvmConfigResult = { error: string } | { chainId: number; rpc: string };

function getEvmConfigOrError(chain: string): EvmConfigResult {
  const parsed = parseCaip2(chain);
  if (!parsed)
    return { error: `Invalid CAIP-2 chain format: ${chain}. Expected 'namespace:chainRef'.` };

  const rpc = getRpcUrl(chain);
  if (!rpc) return { error: `No RPC URL for chain ${chain}. Set RPC_URLS or ALCHEMY_API_KEY.` };

  return { chainId: Number(parsed.chainRef), rpc };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatAmount(atomic: bigint, decimals: number): string {
  return (Number(atomic) / 10 ** decimals).toString();
}

function buildDrainResult(
  drainedAtomic: bigint,
  meta: ChainMeta,
  fromAddress: string,
  toAddress: string,
  remainingAtomic: bigint,
  walletId: string,
  tx?: { type: "svm"; signature: string } | { type: "evm"; hash: string },
) {
  return {
    drained_amount: formatAmount(drainedAtomic, meta.decimals),
    drained_atomic: drainedAtomic.toString(),
    symbol: meta.symbol,
    from_address: fromAddress,
    to_address: toAddress,
    ...(tx?.type === "svm" ? { tx_signature: tx.signature } : {}),
    ...(tx?.type === "evm" ? { tx_hash: tx.hash } : {}),
    remaining_balance: formatAmount(remainingAtomic, meta.decimals),
    wallet_id: walletId,
  };
}

// Minimum rent-exempt balance for a basic account (0 data bytes)
// This is approximately 890,880 lamports (~0.00089 SOL)
const RENT_EXEMPT_MINIMUM = 890_880n;

async function drainSvm(
  wallet: ResolvedWallet,
  treasuryKey: string,
  keepMinimum: number,
  meta: ChainMeta,
) {
  const rpc = getSvmRpcUrl();
  const connection = new Connection(rpc, "confirmed");
  const deploymentKeypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
  const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(treasuryKey));
  const treasuryAddress = treasuryKeypair.publicKey.toBase58();

  const balance = await connection.getBalance(deploymentKeypair.publicKey);
  const balanceLamports = BigInt(balance);

  // Use 5000 lamports as base fee estimate with safety buffer
  const estimatedFee = 10000n;
  const keepMinimumLamports = BigInt(Math.floor(keepMinimum * LAMPORTS_PER_SOL));

  // Must keep rent-exempt minimum to avoid "insufficient funds for rent" error
  // The account needs to either stay rent-exempt or be closed entirely
  const mustKeep = estimatedFee + keepMinimumLamports + RENT_EXEMPT_MINIMUM;
  const drainAmount = balanceLamports > mustKeep ? balanceLamports - mustKeep : 0n;

  if (drainAmount <= 0n) {
    return {
      result: buildDrainResult(
        0n,
        meta,
        wallet.address,
        treasuryAddress,
        balanceLamports,
        wallet.walletId,
      ),
    };
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: deploymentKeypair.publicKey,
      toPubkey: new PublicKey(treasuryAddress),
      lamports: drainAmount,
    }),
  );

  const signature = await sendAndConfirmSvmTransaction(connection, transaction, [
    deploymentKeypair,
  ]);
  const finalBalance = await connection.getBalance(deploymentKeypair.publicKey);

  // Clear state after successful drain (best effort)
  activeWallets.delete("svm");
  clearActiveWalletId("svm").mapErr((e) =>
    logger.warn({ error: e.message }, "Failed to clear active wallet ID"),
  );
  clearLastDeploymentWalletId().mapErr((e) =>
    logger.warn({ error: e.message }, "Failed to clear deployment wallet ID"),
  );

  return {
    result: buildDrainResult(
      drainAmount,
      meta,
      wallet.address,
      treasuryAddress,
      BigInt(finalBalance),
      wallet.walletId,
      { type: "svm", signature },
    ),
  };
}

async function drainEvm(
  wallet: ResolvedWallet,
  treasuryKey: string,
  keepMinimum: string,
  meta: ChainMeta,
  chainId: number,
  rpc: string,
) {
  const deploymentAccount = privateKeyToAccount(normalisePrivateKey(wallet.privateKey));
  const treasuryAccount = privateKeyToAccount(normalisePrivateKey(treasuryKey));

  const publicClient = createPublicClient({ transport: http(rpc) });
  const walletClient = createWalletClient({ account: deploymentAccount, transport: http(rpc) });

  const balance = await publicClient.getBalance({ address: deploymentAccount.address });
  const gasPrice = await publicClient.getGasPrice();
  const gasLimit = 21000n;
  const gasCost = gasPrice * gasLimit;
  const keepMinimumWei = parseUnits(keepMinimum, meta.decimals);
  const drainAmount = balance - gasCost - keepMinimumWei;

  if (drainAmount <= 0n) {
    return {
      result: buildDrainResult(
        0n,
        meta,
        wallet.address,
        treasuryAccount.address,
        balance,
        wallet.walletId,
      ),
    };
  }

  const hash = await walletClient.sendTransaction({
    to: treasuryAccount.address,
    value: drainAmount,
    chain: {
      id: chainId,
      name: meta.name,
      nativeCurrency: { name: meta.name, symbol: meta.symbol, decimals: meta.decimals },
      rpcUrls: { default: { http: [rpc] } },
    },
  });

  const finalBalance = await publicClient.getBalance({ address: deploymentAccount.address });

  // Clear state after successful drain (best effort)
  activeWallets.delete("evm");
  clearActiveWalletId("evm").mapErr((e) =>
    logger.warn({ error: e.message }, "Failed to clear active wallet ID"),
  );
  clearLastDeploymentWalletId().mapErr((e) =>
    logger.warn({ error: e.message }, "Failed to clear deployment wallet ID"),
  );

  return {
    result: buildDrainResult(
      drainAmount,
      meta,
      wallet.address,
      treasuryAccount.address,
      finalBalance,
      wallet.walletId,
      { type: "evm", hash },
    ),
  };
}

const inputSchema = z.object({
  chain: z
    .string()
    .describe(
      "CAIP-2 chain ID (e.g. 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' for Solana mainnet)",
    ),
  keep_minimum: z
    .string()
    .optional()
    .default("0")
    .describe("Minimum amount to keep in the wallet (default: 0, drain everything possible)"),
  wallet_id: z
    .string()
    .optional()
    .describe(
      "Keystore wallet ID to drain. If not provided, uses the active deployment wallet " +
        "(from memory or recovered from persisted state after restart).",
    ),
});

const outputSchema = z.object({
  drained_amount: z.string().describe("Amount drained in human-readable units"),
  drained_atomic: z.string().describe("Amount drained in atomic units (lamports/wei)"),
  symbol: z.string().describe("Native token symbol"),
  from_address: z.string().describe("Deployment wallet address that was drained"),
  to_address: z.string().describe("Treasury wallet address that received funds"),
  tx_signature: z.string().optional().describe("Solana transaction signature"),
  tx_hash: z.string().optional().describe("EVM transaction hash"),
  remaining_balance: z.string().describe("Remaining balance in the deployment wallet"),
  wallet_id: z.string().describe("Keystore wallet ID that was drained"),
});

export function registerDrainDeploymentWalletTool(server: McpServer): void {
  server.registerTool(
    "printr_drain_deployment_wallet",
    {
      description:
        "Drain remaining funds from a deployment wallet back to the treasury. " +
        "Use this after printr_launch_token to recover unused gas funds. " +
        "Automatically calculates gas fees and drains the maximum possible amount. " +
        "Can recover wallets after MCP restart using persisted state and PRINTR_DEPLOYMENT_PASSWORD.",
      inputSchema,
      outputSchema,
    },
    async ({ chain, keep_minimum, wallet_id }) => {
      try {
        const type = chainTypeFromCaip2(chain);

        const walletResult = resolveWallet(type, wallet_id);
        if (walletResult.isErr()) return toolError(walletResult.error.message);
        const wallet = walletResult.value;

        const treasuryResult = getTreasuryKeyOrError(type);
        if ("error" in treasuryResult) return toolError(treasuryResult.error);

        const meta = getChainMeta(chain);
        if (!meta) return toolError(`Unsupported chain: ${chain}`);

        const keepMin = keep_minimum ?? "0";

        if (type === "svm") {
          const { result } = await drainSvm(wallet, treasuryResult.key, parseFloat(keepMin), meta);
          return toolOk(result);
        }

        const evmConfig = getEvmConfigOrError(chain);
        if ("error" in evmConfig) return toolError(evmConfig.error);

        const { result } = await drainEvm(
          wallet,
          treasuryResult.key,
          keepMin,
          meta,
          evmConfig.chainId,
          evmConfig.rpc,
        );
        return toolOk(result);
      } catch (error) {
        return toolError(formatError(error));
      }
    },
  );
}
