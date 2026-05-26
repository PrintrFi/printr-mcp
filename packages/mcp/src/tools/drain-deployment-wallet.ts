import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type ChainType,
  chainTypeFromCaip2,
  decryptKey,
  getActiveWalletId,
  getChainMeta,
  getEvmConfig,
  getLastDeploymentWalletId,
  getWallet,
  toolError,
  toolOk,
} from "@printr/sdk";
import { err, errAsync, ok, type Result } from "neverthrow";
import { match } from "ts-pattern";
import { z } from "zod";
import {
  type DrainError,
  type DrainResult,
  drainEvm,
  drainSvm,
  type ResolvedWallet,
} from "~/lib/drain.js";
import { env } from "~/lib/env.js";
import { logToolExecution } from "~/lib/logging.js";
import { getTreasuryKeyOrError } from "~/lib/treasury.js";
import { activeWallets } from "~/server/wallet-sessions.js";

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

/**
 * Resolve which deployment wallet to drain. Priority:
 * 1. explicit `walletId` param (decrypted from keystore)
 * 2. in-memory active wallet (set by `printr_fund_deployment_wallet`)
 * 3. persisted active wallet id (post-restart recovery)
 * 4. last-deployment wallet id (orphan recovery)
 */
export function resolveWallet(
  type: ChainType,
  walletId?: string,
): Result<ResolvedWallet, DrainError> {
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

export type DrainDeploymentWalletInput = z.infer<typeof inputSchema>;

export type ResolveWalletFn = typeof resolveWallet;
export type GetTreasuryKeyOrErrorFn = typeof getTreasuryKeyOrError;
export type GetChainMetaFn = typeof getChainMeta;
export type GetEvmConfigFn = typeof getEvmConfig;
export type DrainSvmFn = typeof drainSvm;
export type DrainEvmFn = typeof drainEvm;

export type DrainDeploymentWalletDeps = {
  resolveWallet: ResolveWalletFn;
  getTreasuryKeyOrError: GetTreasuryKeyOrErrorFn;
  getChainMeta: GetChainMetaFn;
  getEvmConfig: GetEvmConfigFn;
  drainSvm: DrainSvmFn;
  drainEvm: DrainEvmFn;
};

export function createDrainDeploymentWalletDeps(): DrainDeploymentWalletDeps {
  return {
    resolveWallet,
    getTreasuryKeyOrError,
    getChainMeta,
    getEvmConfig,
    drainSvm,
    drainEvm,
  };
}

export function drainDeploymentWalletHandler(
  input: DrainDeploymentWalletInput,
  deps: DrainDeploymentWalletDeps,
) {
  const { chain, keep_minimum, wallet_id } = input;
  const chainType = chainTypeFromCaip2(chain);
  const keepMin = keep_minimum ?? "0";

  return deps
    .resolveWallet(chainType, wallet_id)
    .asyncAndThen((wallet) => {
      const treasuryResult = deps.getTreasuryKeyOrError(chainType);
      if ("error" in treasuryResult) {
        return errAsync<DrainResult, DrainError>({ message: treasuryResult.error });
      }

      const meta = deps.getChainMeta(chain);
      if (!meta) {
        return errAsync<DrainResult, DrainError>({ message: `Unsupported chain: ${chain}` });
      }

      return match(chainType)
        .with("svm", () => deps.drainSvm(wallet, treasuryResult.key, parseFloat(keepMin), meta))
        .with("evm", () => {
          const evmConfig = deps.getEvmConfig(chain);
          if ("error" in evmConfig) {
            return errAsync<DrainResult, DrainError>({ message: evmConfig.error });
          }
          return deps.drainEvm(
            wallet,
            treasuryResult.key,
            keepMin,
            meta,
            evmConfig.chainId,
            evmConfig.rpc,
          );
        })
        .exhaustive();
    })
    .match(
      (result: DrainResult) => toolOk(result),
      (e: DrainError) => toolError(e.message),
    );
}

export function registerDrainDeploymentWalletTool(server: McpServer): void {
  const deps = createDrainDeploymentWalletDeps();
  server.registerTool(
    "printr_drain_deployment_wallet",
    {
      description:
        "Drain remaining funds from a deployment wallet back to the treasury. " +
        "NOTE: drain runs automatically inside printr_launch_token — only call this tool manually " +
        "to recover a stuck wallet (e.g. after a crash or if printr_launch_token was not called). " +
        "Automatically calculates gas fees and drains the maximum possible amount. " +
        "Can recover wallets after MCP restart using persisted state and PRINTR_DEPLOYMENT_PASSWORD.",
      inputSchema,
      outputSchema,
    },
    logToolExecution("printr_drain_deployment_wallet", (input) =>
      drainDeploymentWalletHandler(input as DrainDeploymentWalletInput, deps),
    ),
  );
}
