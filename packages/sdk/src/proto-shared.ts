/**
 * Shared helpers for the connectrpc/gRPC-Web backend wrappers in
 * {@link "./fees-api.js"} and {@link "./staking-api.js"}. Centralises the
 * singleton client, common conversions, and the proto-flavoured CAIP-10
 * helpers so the two files stop duplicating identical code.
 */

import { type Client, createClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { env } from "./env.js";
import { Backend } from "./proto/api/api_connect.js";
import type { Account } from "./proto/caip/account_pb.js";

const PRINTR_API_URL = env.PRINTR_BACKEND_URL ?? "https://api.printr.money";

/**
 * Proto-flavoured CAIP-10 split: chain id (`namespace:chainRef`) + address.
 * Distinct from {@link "./caip.js".ParsedCaip10}, which keeps namespace and
 * chainRef as separate fields.
 */
export type CaipAccount = {
  chainId: string;
  address: string;
};

let backendClient: Client<typeof Backend> | null = null;

/** Lazily-initialised singleton gRPC-Web client for the Printr backend. */
export function getBackendClient(): Client<typeof Backend> {
  if (!backendClient) {
    const transport = createGrpcWebTransport({ baseUrl: PRINTR_API_URL });
    backendClient = createClient(Backend, transport);
  }
  return backendClient;
}

/** Convert proto {@link Account} into a plain {@link CaipAccount}. */
export function toSimpleAccount(account: Account | undefined): CaipAccount | undefined {
  if (!account) {
    return undefined;
  }
  return { chainId: account.chainId, address: account.address };
}

/**
 * Parse a CAIP-10 string into the proto-flavoured {@link CaipAccount} split
 * (chain id combined, address separate). Throws on malformed input.
 */
export function parseCaip10(caip10: string): CaipAccount {
  const parts = caip10.split(":");
  if (parts.length < 3) {
    throw new Error(`Invalid CAIP-10: ${caip10}`);
  }
  const chainId = `${parts[0]}:${parts[1]}`;
  const address = parts.slice(2).join(":");
  return { chainId, address };
}

/** Format a {@link CaipAccount} as a CAIP-10 string. */
export function formatCaip10(account: CaipAccount): string {
  return `${account.chainId}:${account.address}`;
}
