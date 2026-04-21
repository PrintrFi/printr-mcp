import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type ChainType,
  type ClaimStakingRewardsResult,
  chainTypeFromCaip2,
  claimStakingRewards,
  type EvmPayload,
  getSvmRpcUrl,
  parseStakingCaip10,
  type SimpleTxPayload,
  type SvmPayload,
  signAndSubmitEvm,
  signAndSubmitSvm,
  toToolResponseAsync,
} from "@printr/sdk";
import { err, errAsync, ok, okAsync, Result, ResultAsync } from "neverthrow";
import { z } from "zod";
import { logToolExecution } from "~/lib/logging.js";
import { getTreasuryAddress, getTreasuryKey } from "~/lib/treasury.js";

const inputSchema = z.object({
  position: z.string().describe("CAIP-10 address of the stake position to claim rewards from"),
  creation_tx: z.string().describe("Transaction ID that created this stake position"),
});

const outputSchema = z.object({
  position: z.string().describe("CAIP-10 position address"),
  chain: z.string().describe("Chain where rewards were claimed"),
  tx_hash: z.string().optional().describe("EVM transaction hash"),
  tx_signature: z.string().optional().describe("Solana transaction signature"),
  message: z.string().describe("Status message"),
});

type ClaimOutput = z.infer<typeof outputSchema>;
type ClaimError = { message: string };
type CaipAccount = { chainId: string; address: string };
type TreasuryContext = { treasuryKey: string; treasuryAddress: string };

const claimErr = (message: string): ClaimError => ({ message });
const mapErr = (e: unknown): ClaimError => claimErr(e instanceof Error ? e.message : String(e));

const parsePosition = Result.fromThrowable(parseStakingCaip10, (e) =>
  claimErr(e instanceof Error ? e.message : `Invalid position address: ${String(e)}`),
);

function getTreasuryContext(chainType: ChainType): Result<TreasuryContext, ClaimError> {
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

function buildEvmPayload(
  positionChainId: string,
  evm: Extract<SimpleTxPayload, { case: "evm" }>["value"],
): Result<EvmPayload, ClaimError> {
  const gasLimit = Number(evm.gasLimit);
  if (!Number.isFinite(gasLimit) || gasLimit <= 0) {
    return err(claimErr(`Backend returned invalid gas limit: ${evm.gasLimit}`));
  }
  const target = evm.targetContract?.address;
  if (!target) {
    return err(claimErr("Backend response missing EVM target contract."));
  }
  return ok({
    to: `${positionChainId}:${target}`,
    calldata: evm.calldata,
    value: evm.msgValue || "0",
    gas_limit: gasLimit,
  });
}

function buildSvmPayload(svm: Extract<SimpleTxPayload, { case: "solana" }>["value"]): SvmPayload {
  return {
    ixs: svm.ixs.map((ix) => ({
      program_id: ix.programId?.address || "",
      accounts: ix.accounts.map((acc) => ({
        pubkey: acc.pubkeyBase58,
        is_signer: acc.isSigner,
        is_writable: acc.isWritable,
      })),
      data: ix.dataBase64,
    })),
    lookup_table: svm.lookupTables[0]?.address,
    mint_address: "",
  };
}

function submitClaim(
  position: string,
  positionAccount: CaipAccount,
  treasuryKey: string,
  response: ClaimStakingRewardsResult,
): ResultAsync<ClaimOutput, ClaimError> {
  const txPayload = response.txPayload;
  if (!txPayload || txPayload.case === undefined) {
    return errAsync(
      claimErr("No transaction payload returned. Position may have no claimable rewards."),
    );
  }

  if (txPayload.case === "evm") {
    return buildEvmPayload(positionAccount.chainId, txPayload.value)
      .asyncAndThen((evmPayload) =>
        ResultAsync.fromPromise(signAndSubmitEvm(evmPayload, treasuryKey), mapErr),
      )
      .map(({ tx_hash }) => ({
        position,
        chain: positionAccount.chainId,
        tx_hash,
        message: `Successfully submitted claim. Transaction: ${tx_hash}`,
      }));
  }

  if (txPayload.case === "solana") {
    const svmPayload = buildSvmPayload(txPayload.value);
    const rpc = getSvmRpcUrl();
    return ResultAsync.fromPromise(signAndSubmitSvm(svmPayload, treasuryKey, rpc), mapErr).map(
      ({ signature }) => ({
        position,
        chain: positionAccount.chainId,
        tx_signature: signature,
        message: `Successfully submitted claim. Signature: ${signature}`,
      }),
    );
  }

  const exhaustive: never = txPayload;
  return errAsync(claimErr(`Unknown payload type: ${String(exhaustive)}`));
}

export function registerClaimStakingRewardsTool(server: McpServer): void {
  server.registerTool(
    "printr_claim_staking_rewards",
    {
      description:
        "Claim staking rewards from a specific stake position. " +
        "If the position is already unlocked, this also withdraws the staked principal. " +
        "First use printr_get_staking_positions to find positions with claimable rewards " +
        "or that are unlocked. Uses the treasury wallet to sign and submit the transaction. " +
        "Returns the transaction hash/signature on success.",
      inputSchema,
      outputSchema,
    },
    logToolExecution("printr_claim_staking_rewards", ({ position, creation_tx }) =>
      toToolResponseAsync(
        parsePosition(position)
          .asyncAndThen((positionAccount) =>
            getTreasuryContext(chainTypeFromCaip2(positionAccount.chainId)).asyncAndThen(
              (treasury) => okAsync({ positionAccount, treasury }),
            ),
          )
          .andThen(({ positionAccount, treasury }) => {
            const payerAccount: CaipAccount = {
              chainId: positionAccount.chainId,
              address: treasury.treasuryAddress,
            };
            return ResultAsync.fromPromise(
              claimStakingRewards({
                position: positionAccount,
                payer: payerAccount,
                creationTx: creation_tx,
              }),
              mapErr,
            ).andThen((response) =>
              submitClaim(position, positionAccount, treasury.treasuryKey, response),
            );
          }),
      ),
    ),
  );
}
