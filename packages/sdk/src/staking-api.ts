/**
 * Printr Backend API client for staking operations
 *
 * Uses gRPC-Web to communicate with the Printr backend for querying
 * staking positions and claiming staking rewards.
 */

import { type Client, createClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { env } from "./env.js";
import { Backend } from "./proto/api/api_connect.js";
import {
  type ClaimStakingRewardsResponse,
  ClaimStakingRewardsRequest as ProtoClaimStakingRewardsRequest,
} from "./proto/api/claim_staking_rewards_pb.js";
import { StakingLockPeriod } from "./proto/api/create_stake_position_pb.js";
import {
  type ListStakePositionsWithRewardsResponse,
  ListStakePositionsRequest as ProtoListStakePositionsRequest,
  type StakePositionInfo,
  type StakePositionWithRewardsInfo,
  type StakeTelecoinInfo,
} from "./proto/api/list_stake_positions_pb.js";
import type { AssetAmountV1, TokenAmount } from "./proto/api/misc_pb.js";
import type { EvmTxPayload, SolanaIx, SolanaTxPayload, TxPayload } from "./proto/api/payload_pb.js";
import { Account } from "./proto/caip/account_pb.js";

const PRINTR_API_URL = env.PRINTR_BACKEND_URL ?? "https://api.printr.money";

export { StakingLockPeriod } from "./proto/api/create_stake_position_pb.js";
// Re-export proto types for consumers
export { Account } from "./proto/caip/account_pb.js";

// Simple types for staking API consumers
export type CaipAccount = {
  chainId: string;
  address: string;
};

export type SimpleTokenAmount = {
  atomic: string;
  display: string;
  decimals: number;
};

export type SimpleAssetAmount = {
  asset?: CaipAccount | undefined;
  amount?: SimpleTokenAmount | undefined;
};

export type SimpleStakePositionInfo = {
  telecoinId: string;
  owner?: CaipAccount | undefined;
  position?: CaipAccount | undefined;
  lockPeriod: string;
  staked?: SimpleAssetAmount | undefined;
  createdAt?: string | undefined;
  unlocksAt?: string | undefined;
  wasClosed: boolean;
  creationTx: string;
  shareInStakePoolBps?: number | undefined;
};

export type SimpleStakePositionWithRewards = {
  info?: SimpleStakePositionInfo | undefined;
  claimableQuoteRewards?: SimpleAssetAmount | undefined;
  claimableTelecoinRewards?: SimpleAssetAmount | undefined;
  claimedQuoteRewards?: SimpleAssetAmount | undefined;
  claimedTelecoinRewards?: SimpleAssetAmount | undefined;
};

export type SimpleStakePoolInfo = {
  stakePool?: CaipAccount | undefined;
  totalWeight: string;
  totalOpenPositions: number;
  totalUnlockedWeight: string;
  totalStaked?: SimpleAssetAmount | undefined;
  totalUnlockedStaked?: SimpleAssetAmount | undefined;
};

export type SimpleTelecoinInfo = {
  stakePoolsPerChain: SimpleStakePoolInfo[];
};

export type ListStakePositionsWithRewardsResult = {
  positions: SimpleStakePositionWithRewards[];
  nextCursor?: string | undefined;
  telecoinsById: Record<string, SimpleTelecoinInfo>;
};

export type ListStakePositionsParams = {
  telecoinIds?: string[];
  telecoins?: CaipAccount[];
  owners?: CaipAccount[];
  cursor?: string;
  limit?: number;
};

export type ClaimStakingRewardsParams = {
  position: CaipAccount;
  payer: CaipAccount;
  creationTx: string;
};

export type SimpleEvmPayload = {
  targetContract?: CaipAccount | undefined;
  gasLimit: string;
  msgValue: string;
  calldata: string;
};

export type SimpleSolanaIx = {
  programId?: CaipAccount | undefined;
  accounts: { pubkeyBase58: string; isSigner: boolean; isWritable: boolean }[];
  dataBase64: string;
};

export type SimpleSolanaPayload = {
  ixs: SimpleSolanaIx[];
  lookupTables: CaipAccount[];
};

export type SimpleTxPayload =
  | { case: "evm"; value: SimpleEvmPayload }
  | { case: "solana"; value: SimpleSolanaPayload }
  | { case: undefined; value?: undefined };

export type ClaimStakingRewardsResult = {
  txPayload?: SimpleTxPayload | undefined;
};

// Singleton client
let backendClient: Client<typeof Backend> | null = null;

function getBackendClient(): Client<typeof Backend> {
  if (!backendClient) {
    const transport = createGrpcWebTransport({
      baseUrl: PRINTR_API_URL,
    });
    backendClient = createClient(Backend, transport);
  }
  return backendClient;
}

/**
 * Convert proto Account to CaipAccount
 */
function toSimpleAccount(account: Account | undefined): CaipAccount | undefined {
  if (!account) {
    return undefined;
  }
  return {
    chainId: account.chainId,
    address: account.address,
  };
}

/**
 * Convert proto TokenAmount to SimpleTokenAmount
 */
function toSimpleTokenAmount(amount: TokenAmount | undefined): SimpleTokenAmount | undefined {
  if (!amount) {
    return undefined;
  }
  return {
    atomic: amount.atomic || "0",
    display: amount.display || "0",
    decimals: amount.decimals || 0,
  };
}

/**
 * Convert proto AssetAmountV1 to SimpleAssetAmount
 */
function toSimpleAssetAmount(amount: AssetAmountV1 | undefined): SimpleAssetAmount | undefined {
  if (!amount) {
    return undefined;
  }
  const asset = toSimpleAccount(amount.asset);
  const tokenAmount = toSimpleTokenAmount(amount.amount);
  return {
    ...(asset !== undefined ? { asset } : {}),
    ...(tokenAmount !== undefined ? { amount: tokenAmount } : {}),
  };
}

/**
 * Convert StakingLockPeriod enum to string
 */
function lockPeriodToString(period: StakingLockPeriod): string {
  switch (period) {
    case StakingLockPeriod.SEVEN_DAYS:
      return "7_DAYS";
    case StakingLockPeriod.FOURTEEN_DAYS:
      return "14_DAYS";
    case StakingLockPeriod.THIRTY_DAYS:
      return "30_DAYS";
    case StakingLockPeriod.SIXTY_DAYS:
      return "60_DAYS";
    case StakingLockPeriod.NINETY_DAYS:
      return "90_DAYS";
    case StakingLockPeriod.ONE_HUNDRED_EIGHTY_DAYS:
      return "180_DAYS";
    case StakingLockPeriod.TEN_SECONDS:
      return "10_SECONDS";
    default:
      return "UNSPECIFIED";
  }
}

/**
 * Convert proto StakePositionInfo to simple format
 */
function toSimplePositionInfo(info: StakePositionInfo): SimpleStakePositionInfo {
  const owner = toSimpleAccount(info.owner);
  const position = toSimpleAccount(info.position);
  const staked = toSimpleAssetAmount(info.staked);
  const createdAt = info.createdAt?.toDate().toISOString();
  const unlocksAt = info.unlocksAt?.toDate().toISOString();
  const shareInStakePoolBps = info.shareInStakePool?.bps;

  return {
    telecoinId: info.telecoinId,
    ...(owner !== undefined ? { owner } : {}),
    ...(position !== undefined ? { position } : {}),
    lockPeriod: lockPeriodToString(info.lockPeriod),
    ...(staked !== undefined ? { staked } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(unlocksAt !== undefined ? { unlocksAt } : {}),
    wasClosed: info.wasClosed,
    creationTx: info.creationTx,
    ...(shareInStakePoolBps !== undefined ? { shareInStakePoolBps } : {}),
  };
}

/**
 * Convert proto StakePositionWithRewardsInfo to simple format
 */
function toSimplePositionWithRewards(
  pos: StakePositionWithRewardsInfo,
): SimpleStakePositionWithRewards {
  const info = pos.info ? toSimplePositionInfo(pos.info) : undefined;
  const claimableQuoteRewards = toSimpleAssetAmount(pos.claimableQuoteRewards);
  const claimableTelecoinRewards = toSimpleAssetAmount(pos.claimableTelecoinRewards);
  const claimedQuoteRewards = toSimpleAssetAmount(pos.claimedQuoteRewards);
  const claimedTelecoinRewards = toSimpleAssetAmount(pos.claimedTelecoinRewards);
  return {
    ...(info !== undefined ? { info } : {}),
    ...(claimableQuoteRewards !== undefined ? { claimableQuoteRewards } : {}),
    ...(claimableTelecoinRewards !== undefined ? { claimableTelecoinRewards } : {}),
    ...(claimedQuoteRewards !== undefined ? { claimedQuoteRewards } : {}),
    ...(claimedTelecoinRewards !== undefined ? { claimedTelecoinRewards } : {}),
  };
}

/**
 * Convert proto StakeTelecoinInfo to simple format
 */
function toSimpleTelecoinInfo(info: StakeTelecoinInfo): SimpleTelecoinInfo {
  return {
    stakePoolsPerChain: info.stakePoolsPerChain.map((pool) => {
      const stakePool = toSimpleAccount(pool.stakePool);
      const totalStaked = toSimpleAssetAmount(pool.totalStaked);
      const totalUnlockedStaked = toSimpleAssetAmount(pool.totalUnlockedStaked);
      return {
        ...(stakePool !== undefined ? { stakePool } : {}),
        totalWeight: pool.totalWeight,
        totalOpenPositions: pool.totalOpenPositions,
        totalUnlockedWeight: pool.totalUnlockedWeight,
        ...(totalStaked !== undefined ? { totalStaked } : {}),
        ...(totalUnlockedStaked !== undefined ? { totalUnlockedStaked } : {}),
      };
    }),
  };
}

/**
 * Convert proto EvmTxPayload to simple format
 */
function toSimpleEvmPayload(payload: EvmTxPayload): SimpleEvmPayload {
  const targetContract = toSimpleAccount(payload.targetContract);
  return {
    ...(targetContract !== undefined ? { targetContract } : {}),
    gasLimit: String(payload.gasLimit),
    msgValue: payload.msgValue || "0",
    calldata: payload.hexEncodedPrefixedCalldata || "",
  };
}

/**
 * Convert proto SolanaIx to simple format
 */
function toSimpleSolanaIx(ix: SolanaIx): SimpleSolanaIx {
  const programId = toSimpleAccount(ix.programId);
  return {
    ...(programId !== undefined ? { programId } : {}),
    accounts: ix.accounts.map((acc) => ({
      pubkeyBase58: acc.pubkeyBase58,
      isSigner: acc.isSigner,
      isWritable: acc.isWritable,
    })),
    dataBase64: ix.dataBase64,
  };
}

/**
 * Convert proto SolanaTxPayload to simple format
 */
function toSimpleSolanaPayload(payload: SolanaTxPayload): SimpleSolanaPayload {
  return {
    ixs: payload.ixs.map(toSimpleSolanaIx),
    lookupTables: payload.lookupTables
      .map((lt) => toSimpleAccount(lt))
      .filter((acc): acc is CaipAccount => acc !== undefined),
  };
}

/**
 * Convert proto TxPayload to simple format
 */
function toSimpleTxPayload(payload: TxPayload | undefined): SimpleTxPayload | undefined {
  if (!payload) {
    return undefined;
  }
  const p = payload.payload;
  if (p.case === "evm") {
    return { case: "evm", value: toSimpleEvmPayload(p.value) };
  }
  if (p.case === "solana") {
    return { case: "solana", value: toSimpleSolanaPayload(p.value) };
  }
  return { case: undefined, value: undefined };
}

/**
 * List staking positions with rewards for given owners or telecoins.
 */
export async function listStakePositionsWithRewards(
  request: ListStakePositionsParams,
): Promise<ListStakePositionsWithRewardsResult> {
  const client = getBackendClient();

  const owners = (request.owners || []).map(
    (o) => new Account({ chainId: o.chainId, address: o.address }),
  );
  const telecoins = (request.telecoins || []).map(
    (t) => new Account({ chainId: t.chainId, address: t.address }),
  );

  const protoRequest = new ProtoListStakePositionsRequest({
    telecoinIds: request.telecoinIds || [],
    telecoins,
    owners,
  });

  // Set optional fields only if defined
  if (request.cursor !== undefined) {
    protoRequest.cursor = request.cursor;
  }
  if (request.limit !== undefined) {
    protoRequest.limit = request.limit;
  }

  const response: ListStakePositionsWithRewardsResponse =
    await client.listStakePositionsWithRewards(protoRequest);

  const positions = response.positions.map(toSimplePositionWithRewards);
  const telecoinsById: Record<string, SimpleTelecoinInfo> = {};
  for (const [id, info] of Object.entries(response.telecoinsById)) {
    telecoinsById[id] = toSimpleTelecoinInfo(info);
  }

  const result: ListStakePositionsWithRewardsResult = {
    positions,
    telecoinsById,
  };

  if (response.nextCursor !== undefined) {
    result.nextCursor = response.nextCursor;
  }

  return result;
}

/**
 * Claim staking rewards for a position.
 * Returns transaction payload to be signed and submitted.
 */
export async function claimStakingRewards(
  request: ClaimStakingRewardsParams,
): Promise<ClaimStakingRewardsResult> {
  const client = getBackendClient();

  const protoRequest = new ProtoClaimStakingRewardsRequest({
    position: new Account({ chainId: request.position.chainId, address: request.position.address }),
    payer: new Account({ chainId: request.payer.chainId, address: request.payer.address }),
    creationTx: request.creationTx,
  });

  const response: ClaimStakingRewardsResponse = await client.claimStakingRewards(protoRequest);

  const txPayload = toSimpleTxPayload(response.txPayload);
  const result: ClaimStakingRewardsResult = {};

  if (txPayload !== undefined) {
    result.txPayload = txPayload;
  }

  return result;
}

/**
 * Parse CAIP-10 string into CaipAccount
 */
export function parseCaip10(caip10: string): CaipAccount {
  // Format: namespace:chainRef:address (e.g., eip155:8453:0x123...)
  const parts = caip10.split(":");
  if (parts.length < 3) {
    throw new Error(`Invalid CAIP-10: ${caip10}`);
  }
  const chainId = `${parts[0]}:${parts[1]}`;
  const address = parts.slice(2).join(":");
  return { chainId, address };
}

/**
 * Format CaipAccount as CAIP-10 string
 */
export function formatCaip10(account: CaipAccount): string {
  return `${account.chainId}:${account.address}`;
}
