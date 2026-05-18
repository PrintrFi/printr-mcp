/**
 * Printr Backend API client for fee claiming
 *
 * Uses gRPC-Web to communicate with the Printr backend for querying
 * and claiming creator fees.
 */

import { match, P } from "ts-pattern";
import type {
  ChainProtocolFees as ProtoChainProtocolFees,
  Payload as ProtoPayload,
  PayloadEVM as ProtoPayloadEVM,
  PayloadSolana as ProtoPayloadSolana,
} from "./proto/api/api_pb.js";
import type { AssetAmountV0 } from "./proto/api/misc_pb.js";
import { Account } from "./proto/caip/account_pb.js";
import type {
  AccountMeta as ProtoAccountMeta,
  SolanaIx as ProtoSolanaIx,
} from "./proto/wingman/misc_pb.js";
import { type CaipAccount, getBackendClient, toSimpleAccount } from "./proto-shared.js";

export type { ChainProtocolFees } from "./proto/api/api_pb.js";
// Re-export proto types for consumers
export { Account } from "./proto/caip/account_pb.js";

// Re-exported shared CAIP-10 helpers (kept here so existing
// `parseFeeCaip10` / `formatFeeCaip10` aliases in `index.ts` continue to work).
export { type CaipAccount, formatCaip10, parseCaip10 } from "./proto-shared.js";

export type AssetAmount = {
  asset?: CaipAccount;
  amountAtomic?: string;
  decimals: number;
  priceUsd: number;
  amountUsd: number;
};

export type PayloadEVM = {
  targetChain: string;
  calldata: string;
  txTo: string;
  txValue: string;
  gasLimit: string;
};

export type SolanaAccountMeta = {
  pubkey?: CaipAccount;
  isSigner: boolean;
  isWritable: boolean;
};

export type SolanaIx = {
  programId?: CaipAccount;
  accounts: SolanaAccountMeta[];
  dataBase64: string;
};

export type PayloadSolana = {
  ixs: SolanaIx[];
  lookupTable?: string;
  telecoinMintAddress?: CaipAccount;
};

export type Payload = {
  targetChain: string;
  payload:
    | { case: "evm"; value: PayloadEVM }
    | { case: "svm"; value: PayloadSolana }
    | { case: "svmRaw"; value: { calldata: string } }
    | { case: undefined; value?: undefined };
};

export type ChainProtocolFeesSimple = {
  chainId: string;
  dev?: CaipAccount;
  protocolFees?: AssetAmount;
  devFees?: AssetAmount;
  collectionPayload?: Payload;
  canCollect: boolean;
};

export type ProtocolFeesResponse = {
  telecoinId: string;
  perChain: Record<string, ChainProtocolFeesSimple>;
  totalProtocol?: AssetAmount;
  totalDev?: AssetAmount;
};

export type ProtocolFeesRequest = {
  telecoinId: string;
  chainIds?: string[] | undefined;
  payers?: CaipAccount[] | undefined;
};

/**
 * Convert proto AssetAmountV0 to simple AssetAmount
 */
function toSimpleAssetAmount(amount: AssetAmountV0 | undefined): AssetAmount | undefined {
  if (!amount) {
    return undefined;
  }
  const asset = toSimpleAccount(amount.asset);
  const amountAtomic = amount.amountAtomic?.base10;
  return {
    ...(asset !== undefined ? { asset } : {}),
    ...(amountAtomic !== undefined ? { amountAtomic } : {}),
    decimals: amount.decimals || 0,
    priceUsd: amount.priceUsd || 0,
    amountUsd: amount.amountUsd || 0,
  };
}

/**
 * Convert proto SolanaIx to simple SolanaIx
 */
function toSimpleSolanaIx(ix: ProtoSolanaIx, targetChain: string): SolanaIx {
  // wingman.SolanaIx uses Base58Pubkey which has a `value` field
  const programId = ix.programId?.value
    ? { chainId: targetChain, address: ix.programId.value }
    : undefined;
  return {
    ...(programId !== undefined ? { programId } : {}),
    accounts: (ix.accounts || []).map((acc: ProtoAccountMeta) => {
      const pubkey = acc.pubkey?.value
        ? { chainId: targetChain, address: acc.pubkey.value }
        : undefined;
      return {
        ...(pubkey !== undefined ? { pubkey } : {}),
        isSigner: acc.isSigner || false,
        isWritable: acc.isWritable || false,
      };
    }),
    // wingman.SolanaIx uses `data` field (base64 encoded)
    dataBase64: ix.data || "",
  };
}

/**
 * Convert proto PayloadEVM to simple PayloadEVM
 */
function toSimplePayloadEVM(evm: ProtoPayloadEVM, targetChain: string): PayloadEVM {
  return {
    targetChain: evm.targetChain || targetChain,
    calldata: evm.calldata || "",
    txTo: evm.txTo || "",
    txValue: evm.txValue || "0",
    gasLimit: String(evm.gasLimit || "0"),
  };
}

/**
 * Convert proto PayloadSolana to simple PayloadSolana
 */
function toSimplePayloadSolana(svm: ProtoPayloadSolana, targetChain: string): PayloadSolana {
  const lookupTable = svm.lookupTable?.value;
  const telecoinMintAddress = svm.telecoinMintAddress
    ? {
        chainId: svm.telecoinMintAddress.chainId || "",
        address: svm.telecoinMintAddress.address || "",
      }
    : undefined;
  return {
    ixs: (svm.calldata || []).map((ix) => toSimpleSolanaIx(ix, targetChain)),
    ...(lookupTable !== undefined ? { lookupTable } : {}),
    ...(telecoinMintAddress !== undefined ? { telecoinMintAddress } : {}),
  };
}

/**
 * Convert proto Payload to simple Payload
 */
function toSimplePayload(payload: ProtoPayload | undefined): Payload | undefined {
  if (!payload) {
    return undefined;
  }

  const targetChain = payload.targetChain || "";

  // Exhaustive match on the discriminator — when the proto adds a new variant
  // here, `.exhaustive()` makes this a compile error instead of a silent
  // fallthrough to `{ case: undefined }`.
  return match(payload.payload)
    .returnType<Payload>()
    .with({ case: "evm" }, ({ value }) => ({
      targetChain,
      payload: { case: "evm", value: toSimplePayloadEVM(value, targetChain) },
    }))
    .with({ case: "svm" }, ({ value }) => ({
      targetChain,
      payload: { case: "svm", value: toSimplePayloadSolana(value, targetChain) },
    }))
    .with({ case: "svmRaw" }, ({ value }) => ({
      targetChain,
      payload: { case: "svmRaw", value: { calldata: value.calldata || "" } },
    }))
    .with({ case: P.optional(undefined) }, () => ({
      targetChain,
      payload: { case: undefined, value: undefined },
    }))
    .exhaustive();
}

/**
 * Convert proto ChainProtocolFees to simple format
 */
function toSimpleChainFees(fees: ProtoChainProtocolFees): ChainProtocolFeesSimple {
  const dev = toSimpleAccount(fees.dev);
  const protocolFees = toSimpleAssetAmount(fees.protocolFees);
  const devFees = toSimpleAssetAmount(fees.devFees);
  const collectionPayload = toSimplePayload(fees.collectionPayload);
  return {
    chainId: fees.chainId || "",
    ...(dev !== undefined ? { dev } : {}),
    ...(protocolFees !== undefined ? { protocolFees } : {}),
    ...(devFees !== undefined ? { devFees } : {}),
    ...(collectionPayload !== undefined ? { collectionPayload } : {}),
    canCollect: fees.canCollect || false,
  };
}

/**
 * Call the ProtocolFees RPC endpoint to query claimable fees
 */
export async function getProtocolFees(request: ProtocolFeesRequest): Promise<ProtocolFeesResponse> {
  const client = getBackendClient();

  // Build the proto request
  const payers = (request.payers || []).map(
    (p) => new Account({ chainId: p.chainId, address: p.address }),
  );

  const response = await client.protocolFees({
    telecoinId: request.telecoinId,
    chainIds: request.chainIds || [],
    payers,
  });

  // Convert to simple response format
  const perChain: Record<string, ChainProtocolFeesSimple> = {};
  for (const [chainId, fees] of Object.entries(response.perChain)) {
    perChain[chainId] = toSimpleChainFees(fees);
  }

  const totalProtocol = toSimpleAssetAmount(response.totalProtocol);
  const totalDev = toSimpleAssetAmount(response.totalDev);
  return {
    telecoinId: response.telecoinId,
    perChain,
    ...(totalProtocol !== undefined ? { totalProtocol } : {}),
    ...(totalDev !== undefined ? { totalDev } : {}),
  };
}
