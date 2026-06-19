import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type ChainProtocolFeesSimple,
  chainTypeFromCaip2,
  decryptKey,
  type EvmPayload,
  formatEvmSubmitError,
  formatSvmSubmitError,
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
  transferSvm,
} from "@printr/sdk";
import { err, errAsync, ok, okAsync, type Result, ResultAsync } from "neverthrow";
import { match } from "ts-pattern";
import { z } from "zod";
import { drainSvm } from "~/lib/drain.js";
import { env } from "~/lib/env.js";
import { type HandlerCtx, handler } from "~/lib/handler.js";
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

export type DeploymentWallet = { privateKey: string; address: string; walletId: string };

export type ClaimContext = {
  treasuryKey: string;
  signingKey: string;
  chainFees: ChainProtocolFeesSimple;
  telecoinId: string;
  deploymentWallet?: DeploymentWallet | undefined;
};

/** Fees-API EVM payload → SDK `EvmPayload`. Defaults `value`/`gas_limit` when absent. */
export function toEvmPayload(payload: PayloadEVM, chainId: string): EvmPayload {
  return {
    to: `${chainId}:${payload.txTo}`,
    calldata: payload.calldata,
    value: payload.txValue || "0",
    gas_limit: Number(payload.gasLimit) || 200000,
  };
}

/** Fees-API Solana payload → SDK `SvmPayload`. Coerces optional addresses to `""`. */
export function toSvmPayload(payload: PayloadSolana): SvmPayload {
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

export function getTreasuryContext(
  chain: string,
): Result<{ treasuryKey: string; treasuryAddress: string }, ClaimError> {
  const chainType = chainTypeFromCaip2(chain);
  const treasuryKey = getTreasuryKey(chainType);
  if (!treasuryKey) {
    const envVar = chainType === "svm" ? "SVM" : "EVM";
    return err(
      claimErr(
        `Treasury wallet not configured for ${chainType.toUpperCase()}. ` +
          `Use printr_set_treasury_wallet or set ${envVar}_WALLET_PRIVATE_KEY.`,
      ),
    );
  }
  const treasuryAddress = getTreasuryAddress(chainType);
  if (!treasuryAddress) {
    return err(claimErr("Failed to derive treasury address."));
  }
  return ok({ treasuryKey, treasuryAddress });
}

/** Looks up a deployment wallet key in the keystore for the given creator address. */
function findDeploymentKey(
  chain: string,
  creatorAddress: string,
): { key: string; walletId: string } | undefined {
  const password = env.PRINTR_DEPLOYMENT_PASSWORD;
  if (!password) {
    return undefined;
  }
  const entry = listWallets(chain).find((w) => w.address === creatorAddress);
  if (!entry) {
    return undefined;
  }
  return decryptKey(entry, password).match(
    (key) => ({ key, walletId: entry.id }),
    () => undefined,
  );
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

/**
 * If the creator address differs from treasury, fees belong to a deployment
 * wallet — re-fetch with that wallet as payer to get the correct payload.
 */
export function resolveClaimContext(
  tokenId: string,
  chain: string,
  treasuryKey: string,
  treasuryAddress: string,
): ResultAsync<ClaimContext, ClaimError> {
  return fetchChainFees(tokenId, chain, treasuryAddress).andThen(({ chainFees, telecoinId }) => {
    const creatorAddress = chainFees.dev?.address;
    const fallback = okAsync({ treasuryKey, signingKey: treasuryKey, chainFees, telecoinId });

    if (!creatorAddress || creatorAddress === treasuryAddress) {
      return fallback;
    }

    const deploymentKey = findDeploymentKey(chain, creatorAddress);
    if (!deploymentKey) {
      return fallback;
    }

    return fetchChainFees(tokenId, chain, creatorAddress).map(
      ({ chainFees: creatorFees, telecoinId: creatorTelecoinId }) =>
        creatorFees.canCollect
          ? {
              treasuryKey,
              signingKey: deploymentKey.key,
              chainFees: creatorFees,
              telecoinId: creatorTelecoinId,
              deploymentWallet: {
                privateKey: deploymentKey.key,
                address: creatorAddress,
                walletId: deploymentKey.walletId,
              },
            }
          : {
              treasuryKey,
              chainFees,
              telecoinId,
              signingKey: treasuryKey,
            },
    );
  });
}

/**
 * Drains a deployment wallet back to treasury after a claim. Awaited so the
 * drain attempt completes (and any failure is logged) before the handler
 * resolves — earlier versions returned a floating ResultAsync whose
 * completion the runtime could drop.
 */
async function runPostClaimDrain(
  deploymentWallet: DeploymentWallet,
  treasuryKey: string,
  chain: string,
  rpc: string,
): Promise<void> {
  const meta = getChainMeta(chain);
  if (!meta) {
    return;
  }
  (await drainSvm(deploymentWallet, treasuryKey, 0, meta, rpc)).mapErr((e) =>
    logger.warn(`Failed to drain deployment wallet after fee claim: ${e.message}`),
  );
}

/**
 * If the signer is a drained deployment wallet, pre-fund it from treasury,
 * claim with the deployment key, then drain it back.
 */
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
      signAndSubmitSvm(svmPayload, signingKey, rpc).mapErr((e) =>
        claimErr(formatSvmSubmitError(e)),
      ),
    )
    .andThen(({ signature }) =>
      ResultAsync.fromSafePromise(
        deploymentWallet
          ? runPostClaimDrain(deploymentWallet, treasuryKey, chain, rpc).then(() => signature)
          : Promise.resolve(signature),
      ),
    );
}

export function executeClaim(
  ctx: ClaimContext,
  chain: string,
): ResultAsync<ClaimOutput, ClaimError> {
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
      signAndSubmitEvm(toEvmPayload(value, chain), signingKey)
        .mapErr((e) => claimErr(formatEvmSubmitError(e)))
        .map(({ tx_hash }) => ({ ...base, tx_hash })),
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

export type ClaimFeesInput = z.infer<typeof inputSchema>;

export type GetTreasuryContextFn = typeof getTreasuryContext;
export type ResolveClaimContextFn = typeof resolveClaimContext;
export type ExecuteClaimFn = typeof executeClaim;

export type ClaimFeesDeps = {
  getTreasuryContext: GetTreasuryContextFn;
  resolveClaimContext: ResolveClaimContextFn;
  executeClaim: ExecuteClaimFn;
};

export function createClaimFeesDeps(): ClaimFeesDeps {
  return { getTreasuryContext, resolveClaimContext, executeClaim };
}

export function claimFeesHandler({
  input,
  deps,
}: HandlerCtx<ClaimFeesInput, ClaimFeesDeps>): ResultAsync<ClaimOutput, ClaimError> {
  const { token_id, chain } = input;
  return deps
    .getTreasuryContext(chain)
    .asyncAndThen(({ treasuryKey, treasuryAddress }) =>
      deps
        .resolveClaimContext(token_id, chain, treasuryKey, treasuryAddress)
        .andThen((ctx) => deps.executeClaim(ctx, chain)),
    );
}

/**
 * Registers the `printr_claim_fees` MCP tool, which claims accumulated creator fees for a
 * token on a specific chain using the treasury wallet to sign and submit the transaction.
 *
 * @param server - MCP server instance to register the tool against
 */
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
    handler("printr_claim_fees", claimFeesHandler)(createClaimFeesDeps()),
  );
}
