import type {
  EvmPayload,
  EvmSubmitError,
  EvmSubmitResult,
  RpcInput,
  SvmPayload,
  SvmSubmitError,
  SvmSubmitResult,
} from "@printr/sdk";
import type { ResultAsync } from "neverthrow";
import { match } from "ts-pattern";

/**
 * Identifies which backend a {@link Signer} is implemented by.
 *
 * `local` and (later) `privy` are non-OKX-channel adapters; `onchainos` and
 * `browser` are the only kinds permitted in the OKX-pinned tree (see
 * docs/adr/0001-okx-signing-architecture.md). `fake` is test-only.
 */
export type SignerKind = "local" | "onchainos" | "browser" | "privy" | "fake";

/**
 * Error raised while resolving a signer or its address.
 *
 * Distinct from the on-chain submit errors (`EvmSubmitError` / `SvmSubmitError`),
 * which describe failures during signing, broadcast, or confirmation.
 */
export type SignerError =
  | { kind: "unsupported_chain"; caip2: string }
  | { kind: "wallet_unavailable"; message: string }
  | { kind: "resolution_failed"; message: string };

/** Render a {@link SignerError} into a human-readable message. */
export function formatSignerError(e: SignerError): string {
  return match(e)
    .with({ kind: "unsupported_chain" }, (x) => `This signer does not support chain ${x.caip2}.`)
    .with({ kind: "wallet_unavailable" }, (x) => x.message)
    .with({ kind: "resolution_failed" }, (x) => `Signer resolution failed: ${x.message}`)
    .exhaustive();
}

/**
 * A signing backend behind which a concrete wallet implementation is hidden.
 *
 * The private key (if any) never crosses this boundary: a caller hands over an
 * unsigned payload and receives a submitted-transaction result. Adapters wrap a
 * local keystore key, a TEE service (onchainos), a browser flow, or a test
 * double — selected per chain by {@link selectSigner}.
 *
 * A signer scoped to one chain type returns a `signing_failed` submit error from
 * the method for the other type; callers reach the correct method via selection,
 * so this only guards misuse.
 */
export type Signer = {
  readonly kind: SignerKind;
  /** Resolve the wallet address this signer will use for `caip2`. */
  resolveAddress(caip2: string): ResultAsync<string, SignerError>;
  /** Sign, broadcast, and confirm an EVM payload. */
  signAndSubmitEvm(
    payload: EvmPayload,
    rpcUrl?: RpcInput,
  ): ResultAsync<EvmSubmitResult, EvmSubmitError>;
  /** Sign, broadcast, and confirm a Solana payload. */
  signAndSubmitSvm(
    payload: SvmPayload,
    rpcUrl?: RpcInput,
  ): ResultAsync<SvmSubmitResult, SvmSubmitError>;
};
