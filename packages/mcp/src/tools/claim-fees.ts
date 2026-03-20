import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type ChainProtocolFeesSimple,
  chainTypeFromCaip2,
  decryptKey,
  type EvmPayload,
  getChainMeta,
  getProtocolFees,
  getSvmRpcUrl,
  listWallets,
  logger,
  type PayloadEVM,
  type PayloadSolana,
  type SvmPayload,
  signAndSubmitEvm,
  signAndSubmitSvm,
  toToolResponseAsync,
  transferSvm,
} from "@printr/sdk";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { match } from "ts-pattern";
import { z } from "zod";
import { drainSvm } from "~/lib/drain.js";
import { env } from "~/lib/env.js";
import { logToolExecution } from "~/lib/logging.js";
import { getTreasuryAddress, getTreasuryKey } from "~/lib/treasury.js";

const inputSchema = z.object({
  token_id: z.string().describe("Telecoin ID (hex) or CAIP-10 token address"),
  chain: z
    .string()
    .describe("CAIP-2 chain ID to claim fees on (e.g., 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')"),
});

const outputSchema = z.object({
  token_id: z.string().describe("Telecoin ID"),
  chain: z.string().describe("Chain where fees were claimed"),
  claimed_amount_usd: z.number().describe("Amount claimed in USD"),
  claimed_amount_native: z.string().describe("Amount claimed in native token (atomic)"),
  native_symbol: z.string().describe("Native token symbol"),
  tx_hash: z.string().optional().describe("EVM transaction hash"),
  tx_signature: z.string().optional().describe("Solana transaction signature"),
});

type ClaimOutput = z.infer<typeof outputSchema>;
type ClaimError = { message: string };

function claimErr(message: string): ClaimError {
  return { message };
}

function mapErr(e: unknown): ClaimError {
  return claimErr(e instanceof Error ? e.message : String(e));
}

type DeploymentWallet = { privateKey: string; address: string; walletId: string };

type ClaimContext = {
  treasuryKey: string;
  signingKey: string;
  chainFees: ChainProtocolFeesSimple;
  telecoinId: string;
  deploymentWallet?: DeploymentWallet | undefined;
};

function toEvmPayload(payload: PayloadEVM, chainId: string): EvmPayload {
  return {
    to: `${chainId}:${payload.txTo}`,
    calldata: payload.calldata,
    value: payload.txValue || "0",
    gas_limit: Number(payload.gasLimit) || 200000,
  };
}

function toSvmPayload(payload: PayloadSolana): SvmPayload {
  return {
    ixs: payload.ixs.map((ix) => ({
      program_id: ix.programId?.address || "",
      accounts: ix.accounts.map((acc) => ({
        pubkey: acc.pubkey?.address || "",
        is_signer: acc.isSigner,
        is_writable: acc.isWritable,
      })),
      data: ix.dataBase64,
    })),
    lookup_table: payload.lookupTable,
    mint_address: payload.telecoinMintAddress?.address || "",
  };
}

function fetchChainFees(
  tokenId: string,
  chain: string,
  payerAddress: string,
): ResultAsync<{ chainFees: ChainProtocolFeesSimple; telecoinId: string }, ClaimError> {
  return ResultAsync.fromPromise(
    getProtocolFees({
      telecoinId: tokenId,
      chainIds: [chain],
      payers: [{ chainId: chain, address: payerAddress }],
    }),
    mapErr,
  ).andThen((response) => {
    const chainFees = response.perChain[chain];
    if (!chainFees) {
      return errAsync(claimErr(`No fee data returned for chain ${chain}.`));
    }
    return okAsync({ chainFees, telecoinId: response.telecoinId || tokenId });
  });
}

// If the creator address differs from treasury, fees belong to a deployment wallet.
// Re-fetch with that wallet as payer to get the correct collection payload.
function resolveClaimContext(
  tokenId: string,
  chain: string,
  treasuryKey: string,
  treasuryAddress: string,
): ResultAsync<ClaimContext, ClaimError> {
  return fetchChainFees(tokenId, chain, treasuryAddress).andThen(({ chainFees, telecoinId }) => {
    const creatorAddress = chainFees.dev?.address;
    const creatorIsNotTreasury = creatorAddress && creatorAddress !== treasuryAddress;

    if (creatorIsNotTreasury) {
      const entry = listWallets(chain).find((w) => w.address === creatorAddress);
      const password = env.PRINTR_DEPLOYMENT_PASSWORD;
      if (entry && password) {
        const keyResult = decryptKey(entry, password);
        if (keyResult.isOk()) {
          return fetchChainFees(tokenId, chain, creatorAddress).map(
            ({ chainFees: creatorFees, telecoinId: creatorTelecoinId }) =>
              creatorFees.canCollect
                ? {
                    treasuryKey,
                    signingKey: keyResult.value,
                    chainFees: creatorFees,
                    telecoinId: creatorTelecoinId,
                    deploymentWallet: {
                      privateKey: keyResult.value,
                      address: creatorAddress,
                      walletId: entry.id,
                    },
                  }
                : { treasuryKey, signingKey: treasuryKey, chainFees, telecoinId },
          );
        }
      }
    }

    return okAsync({ treasuryKey, signingKey: treasuryKey, chainFees, telecoinId });
  });
}

// If the signer is a drained deployment wallet, pre-fund it from treasury,
// claim with the deployment key, then drain it back.
function claimSvm(
  svmPayload: SvmPayload,
  ctx: ClaimContext,
  chain: string,
): ResultAsync<string, ClaimError> {
  const { signingKey, treasuryKey, deploymentWallet } = ctx;
  const rpc = getSvmRpcUrl();
  const GAS_RESERVE = 10_000_000n; // 0.01 SOL — covers rent for new token accounts + gas

  const fundStep: ResultAsync<undefined, ClaimError> = deploymentWallet
    ? ResultAsync.fromPromise(
        transferSvm(deploymentWallet.address, GAS_RESERVE, treasuryKey, rpc).then(() => undefined),
        mapErr,
      )
    : okAsync(undefined);

  return fundStep
    .andThen(() =>
      ResultAsync.fromPromise<{ signature: string }, ClaimError>(
        signAndSubmitSvm(svmPayload, signingKey, rpc),
        mapErr,
      ),
    )
    .map(({ signature }) => {
      if (deploymentWallet) {
        const meta = getChainMeta(chain);
        if (meta) {
          drainSvm(deploymentWallet, treasuryKey, 0, meta, rpc).mapErr((e) =>
            logger.warn(`Failed to drain deployment wallet after fee claim: ${e.message}`),
          );
        }
      }
      return signature;
    });
}

function executeClaim(ctx: ClaimContext, chain: string): ResultAsync<ClaimOutput, ClaimError> {
  const { chainFees, telecoinId, signingKey } = ctx;

  if (!chainFees.canCollect) {
    return errAsync(
      claimErr(
        `No fees available to claim on ${chain}. ` +
          `Creator fees: $${chainFees.devFees?.amountUsd?.toFixed(2) ?? "0.00"}`,
      ),
    );
  }

  const payload = chainFees.collectionPayload;
  if (!payload || payload.payload.case === undefined) {
    return errAsync(
      claimErr("No collection payload returned from API. Fees may not be claimable yet."),
    );
  }

  const base = {
    token_id: telecoinId,
    chain,
    claimed_amount_usd: chainFees.devFees?.amountUsd ?? 0,
    claimed_amount_native: chainFees.devFees?.amountAtomic ?? "0",
    native_symbol: chainTypeFromCaip2(chain) === "svm" ? "SOL" : "ETH",
  };

  return match(payload.payload)
    .with({ case: "evm" }, ({ value }) =>
      ResultAsync.fromPromise(signAndSubmitEvm(toEvmPayload(value, chain), signingKey), mapErr).map(
        ({ tx_hash }) => ({ ...base, tx_hash }),
      ),
    )
    .with({ case: "svm" }, ({ value }) =>
      claimSvm(toSvmPayload(value), ctx, chain).map((tx_signature) => ({
        ...base,
        tx_signature,
      })),
    )
    .with({ case: "svmRaw" }, () =>
      errAsync(
        claimErr(
          "Raw SVM payload not yet supported. Please use the web UI to claim fees on this chain.",
        ),
      ),
    )
    .otherwise(() => errAsync(claimErr(`Unknown payload type: ${String(payload.payload.case)}`)));
}

export function registerClaimFeesTool(server: McpServer): void {
  server.registerTool(
    "printr_claim_fees",
    {
      description:
        "Claim accumulated creator fees for a token on a specific chain. " +
        "First use printr_get_creator_fees to check available fees, then call this to claim. " +
        "Uses the treasury wallet to sign and submit the claim transaction. " +
        "Returns the transaction hash/signature on success.",
      inputSchema,
      outputSchema,
    },
    logToolExecution("printr_claim_fees", ({ token_id, chain }) => {
      const chainType = chainTypeFromCaip2(chain);
      const treasuryKey = getTreasuryKey(chainType);

      if (!treasuryKey) {
        const envVar = chainType === "svm" ? "SVM" : "EVM";
        return Promise.resolve({
          content: [
            {
              type: "text" as const,
              text:
                `Treasury wallet not configured for ${chainType.toUpperCase()}. ` +
                `Use printr_set_treasury_wallet or set ${envVar}_WALLET_PRIVATE_KEY.`,
            },
          ],
          isError: true as const,
        });
      }

      const treasuryAddress = getTreasuryAddress(chainType);
      if (!treasuryAddress) {
        return Promise.resolve({
          content: [{ type: "text" as const, text: "Failed to derive treasury address." }],
          isError: true as const,
        });
      }

      return toToolResponseAsync(
        resolveClaimContext(token_id, chain, treasuryKey, treasuryAddress).andThen((ctx) =>
          executeClaim(ctx, chain),
        ),
      );
    }),
  );
}
