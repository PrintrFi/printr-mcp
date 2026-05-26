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
  type ToolResponse,
  toToolResponseAsync,
  transferSvm,
} from "@printr/sdk";
import { err, errAsync, ok, okAsync, type Result, ResultAsync } from "neverthrow";
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

export type DeploymentWallet = { privateKey: string; address: string; walletId: string };

export type ClaimContext = {
  treasuryKey: string;
  signingKey: string;
  chainFees: ChainProtocolFeesSimple;
  telecoinId: string;
  deploymentWallet?: DeploymentWallet | undefined;
};

/**
 * Translate a fees-API EVM payload into the SDK's `EvmPayload` shape used by
 * `signAndSubmitEvm`. Builds the CAIP-10 `to` from the chain id + `txTo`,
 * defaults `value` to `"0"` and `gas_limit` to 200000 when the source omits
 * them. Exported so a regression to "defaults to 0 gas" gets caught at unit
 * level rather than on chain.
 */
export function toEvmPayload(payload: PayloadEVM, chainId: string): EvmPayload {
  return {
    to: `${chainId}:${payload.txTo}`,
    calldata: payload.calldata,
    value: payload.txValue || "0",
    gas_limit: Number(payload.gasLimit) || 200000,
  };
}

/**
 * Translate a fees-API Solana payload into the SDK's `SvmPayload` shape.
 * Optional address fields are coerced to `""` rather than dropped so the
 * downstream signer always sees a string. Exported for spec coverage of the
 * instruction / account / mint normalisation paths.
 */
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

/** Resolve the treasury private key + derived address for the chain. */
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

// Looks up a deployment wallet key in the keystore for the given creator address.
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
 * Resolve the `ClaimContext` for a claim. If the chain's creator address
 * differs from the treasury, fees belong to a deployment wallet — re-fetch
 * with that wallet as payer to get the correct collection payload.
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
      signAndSubmitSvm(svmPayload, signingKey, rpc).mapErr((e) =>
        claimErr(formatSvmSubmitError(e)),
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

/**
 * Run the claim against a resolved `ClaimContext`. Dispatches to the EVM /
 * SVM / svmRaw branch based on the collection payload discriminator and
 * returns the user-facing `ClaimOutput`.
 */
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

// ---------------------------------------------------------------------------
// Deps + handler
// ---------------------------------------------------------------------------

/** Validated input shape passed to the registered tool handler. */
export type ClaimFeesInput = z.infer<typeof inputSchema>;

export type GetTreasuryContextFn = typeof getTreasuryContext;
export type ResolveClaimContextFn = typeof resolveClaimContext;
export type ExecuteClaimFn = typeof executeClaim;

/**
 * Capability bundle for the `printr_claim_fees` handler. Each composable
 * step is a dep so tests can stub canned `Result` returns and exercise the
 * dispatch / error-surfacing branches without touching the protocol-fees
 * API, the keystore, or the signing primitives.
 */
export type ClaimFeesDeps = {
  getTreasuryContext: GetTreasuryContextFn;
  resolveClaimContext: ResolveClaimContextFn;
  executeClaim: ExecuteClaimFn;
};

/** Build production-wired deps for {@link claimFeesHandler}. */
export function createClaimFeesDeps(): ClaimFeesDeps {
  return { getTreasuryContext, resolveClaimContext, executeClaim };
}

/**
 * `printr_claim_fees` handler. Resolves the treasury for the chain, derives
 * the claim context (which re-fetches as the deployment-wallet payer when
 * the creator address differs from treasury), then dispatches to
 * `executeClaim`. Surfaces a `ToolResponse` end-to-end.
 */
export function claimFeesHandler(
  input: ClaimFeesInput,
  deps: ClaimFeesDeps,
): Promise<ToolResponse<Record<string, unknown>>> {
  const { token_id, chain } = input;
  return toToolResponseAsync(
    deps
      .getTreasuryContext(chain)
      .asyncAndThen(({ treasuryKey, treasuryAddress }) =>
        deps
          .resolveClaimContext(token_id, chain, treasuryKey, treasuryAddress)
          .andThen((ctx) => deps.executeClaim(ctx, chain)),
      ),
  );
}

export function registerClaimFeesTool(server: McpServer): void {
  const deps = createClaimFeesDeps();
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
    logToolExecution("printr_claim_fees", (input) =>
      claimFeesHandler(input as ClaimFeesInput, deps),
    ),
  );
}
