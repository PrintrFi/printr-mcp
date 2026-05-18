/**
 * Shared helpers for the connectrpc/gRPC-Web backend wrappers in
 * {@link "./fees-api.js"} and {@link "./staking-api.js"}. Centralises the
 * singleton client, common conversions, and the proto-flavoured CAIP-10
 * helpers so the two files stop duplicating identical code.
 */

import { type Client, createClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { err, ok, type Result } from "neverthrow";
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

/** Error returned by {@link tryParseCaip10} for unrecoverable input. */
export type ParseCaip10Error = { kind: "invalid_caip10"; input: string };

/**
 * Safe parser variant of {@link parseCaip10} — returns a {@link Result} instead
 * of throwing. Prefer this at any boundary where the input is untrusted.
 */
export function tryParseCaip10(caip10: string): Result<CaipAccount, ParseCaip10Error> {
  const parts = caip10.split(":");
  if (parts.length < 3) {
    return err({ kind: "invalid_caip10", input: caip10 });
  }
  const chainId = `${parts[0]}:${parts[1]}`;
  const address = parts.slice(2).join(":");
  return ok({ chainId, address });
}

/**
 * Parse a CAIP-10 string into the proto-flavoured {@link CaipAccount} split
 * (chain id combined, address separate). Throws on malformed input — prefer
 * {@link tryParseCaip10} when the input is untrusted.
 */
export function parseCaip10(caip10: string): CaipAccount {
  return tryParseCaip10(caip10).match(
    (account) => account,
    (e) => {
      throw new Error(`Invalid CAIP-10: ${e.input}`);
    },
  );
}

/** Format a {@link CaipAccount} as a CAIP-10 string. */
export function formatCaip10(account: CaipAccount): string {
  return `${account.chainId}:${account.address}`;
}
