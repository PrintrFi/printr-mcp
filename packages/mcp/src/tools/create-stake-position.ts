import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type CaipAccount,
  type ChainType,
  type CreateStakePositionResult,
  chainTypeFromCaip2,
  createStakePosition,
  type EvmPayload,
  formatEvmSubmitError,
  formatSvmSubmitError,
  getSvmRpcUrl,
  parseLockPeriod,
  parseStakingCaip10,
  type SvmPayload,
  signAndSubmitEvm,
  signAndSubmitSvm,
  toToolResponseAsync,
} from "@printr/sdk";
import { err, errAsync, ok, okAsync, Result, ResultAsync } from "neverthrow";
import { z } from "zod";
import { logToolExecution } from "~/lib/logging.js";
import { getTreasuryAddress, getTreasuryKey, type TreasuryContext } from "~/lib/treasury.js";
import type { EvmTxValue, SvmTxValue } from "~/lib/tx-payload.js";

const LOCK_PERIODS = [
  "7_DAYS",
  "14_DAYS",
  "30_DAYS",
  "60_DAYS",
  "90_DAYS",
  "180_DAYS",
  "10_SECONDS",
] as const;

const inputSchema = z.object({
  telecoin_id: z.string().describe("Telecoin ID (hex) to stake"),
  asset: z.string().describe("CAIP-10 address of the asset to stake (typically the telecoin mint)"),
  atomic: z.string().describe("Amount to stake in the asset's smallest unit (atomic)"),
  decimals: z.number().int().describe("Decimals of the asset being staked"),
  lock_period: z
    .enum(LOCK_PERIODS)
    .describe("Lock period for the stake position (currently Solana-only)"),
});

const outputSchema = z.object({
  telecoin_id: z.string().describe("Telecoin ID that was staked"),
  chain: z.string().describe("CAIP-2 chain where the position was created"),
  payer: z.string().describe("CAIP-10 payer address (the treasury wallet)"),
  lock_period: z.string().describe("Lock period applied to the position"),
  staked_atomic: z.string().describe("Staked amount in atomic units"),
  tx_hash: z.string().optional().describe("EVM transaction hash"),
  tx_signature: z.string().optional().describe("Solana transaction signature"),
  message: z.string().describe("Status message"),
});

type CreateOutput = z.infer<typeof outputSchema>;
type CreateError = { message: string };

const createErr = (message: string): CreateError => ({ message });
const mapErr = (e: unknown): CreateError => createErr(e instanceof Error ? e.message : String(e));

const parseAsset = Result.fromThrowable(parseStakingCaip10, (e) =>
  createErr(e instanceof Error ? e.message : `Invalid asset address: ${String(e)}`),
);

const parsePeriod = Result.fromThrowable(parseLockPeriod, (e) =>
  createErr(e instanceof Error ? e.message : `Invalid lock period: ${String(e)}`),
);

function getTreasuryContext(chainType: ChainType): Result<TreasuryContext, CreateError> {
  const treasuryKey = getTreasuryKey(chainType);
  if (!treasuryKey) {
    const envVar = chainType === "svm" ? "SVM" : "EVM";
    return err(
      createErr(
        `Treasury wallet not configured for ${chainType.toUpperCase()}. ` +
          `Use printr_set_treasury_wallet or set ${envVar}_WALLET_PRIVATE_KEY.`,
      ),
    );
  }
  const treasuryAddress = getTreasuryAddress(chainType);
  if (!treasuryAddress) {
    return err(createErr("Failed to derive treasury address."));
  }
  return ok({ treasuryKey, treasuryAddress });
}

function buildEvmPayload(chainId: string, evm: EvmTxValue): Result<EvmPayload, CreateError> {
  const gasLimit = Number(evm.gasLimit);
  if (!Number.isFinite(gasLimit) || gasLimit <= 0) {
    return err(createErr(`Backend returned invalid gas limit: ${evm.gasLimit}`));
  }
  const target = evm.targetContract?.address;
  if (!target) {
    return err(createErr("Backend response missing EVM target contract."));
  }
  return ok({
    to: `${chainId}:${target}`,
    calldata: evm.calldata,
    value: evm.msgValue || "0",
    gas_limit: gasLimit,
  });
}

function buildSvmPayload(svm: SvmTxValue): Result<SvmPayload, CreateError> {
  if (svm.lookupTables.length > 1) {
    return err(
      createErr(
        `Backend returned ${svm.lookupTables.length} lookup tables, but only 1 is supported.`,
      ),
    );
  }

  const ixs: SvmPayload["ixs"] = [];
  for (const [ixIndex, ix] of svm.ixs.entries()) {
    const programId = ix.programId?.address;
    if (!programId) {
      return err(
        createErr(`Backend response missing Solana program ID for instruction ${ixIndex}.`),
      );
    }

    const accounts: SvmPayload["ixs"][number]["accounts"] = [];
    for (const [accIndex, acc] of ix.accounts.entries()) {
      if (!acc.pubkeyBase58) {
        return err(
          createErr(
            `Backend response missing Solana account pubkey for instruction ${ixIndex}, account ${accIndex}.`,
          ),
        );
      }
      accounts.push({
        pubkey: acc.pubkeyBase58,
        is_signer: acc.isSigner,
        is_writable: acc.isWritable,
      });
    }

    ixs.push({
      program_id: programId,
      accounts,
      data: ix.dataBase64,
    });
  }

  return ok({
    ixs,
    lookup_table: svm.lookupTables[0]?.address,
    mint_address: "",
  });
}

type SubmitContext = {
  telecoinId: string;
  chainId: string;
  payerAddress: string;
  lockPeriodLabel: string;
  stakedAtomic: string;
  treasuryKey: string;
};

function submitCreate(
  ctx: SubmitContext,
  response: CreateStakePositionResult,
): ResultAsync<CreateOutput, CreateError> {
  const txPayload = response.txPayload;
  if (!txPayload || txPayload.case === undefined) {
    return errAsync(createErr("No transaction payload returned from backend."));
  }

  const base: Omit<CreateOutput, "message" | "tx_hash" | "tx_signature"> = {
    telecoin_id: ctx.telecoinId,
    chain: ctx.chainId,
    payer: `${ctx.chainId}:${ctx.payerAddress}`,
    lock_period: ctx.lockPeriodLabel,
    staked_atomic: ctx.stakedAtomic,
  };

  if (txPayload.case === "evm") {
    return buildEvmPayload(ctx.chainId, txPayload.value)
      .asyncAndThen((evmPayload) =>
        signAndSubmitEvm(evmPayload, ctx.treasuryKey).mapErr((e) =>
          createErr(formatEvmSubmitError(e)),
        ),
      )
      .map(({ tx_hash }) => ({
        ...base,
        tx_hash,
        message: `Created stake position. Transaction: ${tx_hash}`,
      }));
  }

  if (txPayload.case === "solana") {
    const rpc = getSvmRpcUrl();
    return buildSvmPayload(txPayload.value)
      .asyncAndThen((svmPayload) =>
        signAndSubmitSvm(svmPayload, ctx.treasuryKey, rpc).mapErr((e) =>
          createErr(formatSvmSubmitError(e)),
        ),
      )
      .map(({ signature }) => ({
        ...base,
        tx_signature: signature,
        message: `Created stake position. Signature: ${signature}`,
      }));
  }

  const exhaustive: never = txPayload;
  return errAsync(createErr(`Unknown payload type: ${String(exhaustive)}`));
}

/**
 * Registers the `printr_create_stake_position` MCP tool, which creates a new stake position
 * for a telecoin using the treasury wallet as payer and owner, then signs and submits the
 * returned transaction on-chain.
 *
 * @param server - MCP server instance to register the tool against
 */
export function registerCreateStakePositionTool(server: McpServer): void {
  server.registerTool(
    "printr_create_stake_position",
    {
      description:
        "Create a new stake position for a telecoin. " +
        "Specify the telecoin id, the asset/amount to stake, and the lock period. " +
        "Uses the treasury wallet (on the asset's chain) as the payer and position owner, " +
        "then signs and submits the returned transaction on-chain. " +
        "Currently only Solana telecoins can be staked. " +
        "Returns the transaction hash/signature on success.",
      inputSchema,
      outputSchema,
    },
    logToolExecution(
      "printr_create_stake_position",
      ({ telecoin_id, asset, atomic, decimals, lock_period }) =>
        toToolResponseAsync(
          Result.combine([parseAsset(asset), parsePeriod(lock_period)])
            .asyncAndThen(([assetAccount, lockPeriodEnum]) => {
              const chainType = chainTypeFromCaip2(assetAccount.chainId);
              return getTreasuryContext(chainType).asyncAndThen((treasury) =>
                okAsync({ assetAccount, lockPeriodEnum, treasury }),
              );
            })
            .andThen(({ assetAccount, lockPeriodEnum, treasury }) => {
              const payerAccount: CaipAccount = {
                chainId: assetAccount.chainId,
                address: treasury.treasuryAddress,
              };
              return ResultAsync.fromPromise(
                createStakePosition({
                  telecoinId: telecoin_id,
                  payer: payerAccount,
                  toStake: {
                    asset: assetAccount,
                    atomic,
                    decimals,
                  },
                  lockPeriod: lockPeriodEnum,
                }),
                mapErr,
              ).andThen((response) =>
                submitCreate(
                  {
                    telecoinId: telecoin_id,
                    chainId: assetAccount.chainId,
                    payerAddress: treasury.treasuryAddress,
                    lockPeriodLabel: lock_period,
                    stakedAtomic: atomic,
                    treasuryKey: treasury.treasuryKey,
                  },
                  response,
                ),
              );
            }),
        ),
    ),
  );
}
