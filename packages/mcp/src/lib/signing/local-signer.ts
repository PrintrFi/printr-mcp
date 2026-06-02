import {
  type ChainType,
  chainTypeFromCaip2,
  type EvmSubmitError,
  type EvmSubmitResult,
  normalisePrivateKey,
  type SvmSubmitError,
  type SvmSubmitResult,
  signAndSubmitEvm,
  signAndSubmitSvm,
} from "@printr/sdk";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { errAsync, Result } from "neverthrow";
import { match } from "ts-pattern";
import { privateKeyToAccount } from "viem/accounts";
import type { Signer, SignerError } from "./port.js";
import { toAsync } from "./to-async.js";

function deriveAddress(privateKey: string, type: ChainType): string {
  return match(type)
    .with("evm", () => privateKeyToAccount(normalisePrivateKey(privateKey)).address)
    .with("svm", () => Keypair.fromSecretKey(bs58.decode(privateKey)).publicKey.toBase58())
    .exhaustive();
}

/** {@link deriveAddress} as a railway step — key parsing throws on malformed input. */
const deriveAddressSafe = Result.fromThrowable(
  deriveAddress,
  (e): SignerError => ({
    kind: "resolution_failed",
    message: e instanceof Error ? e.message : "Failed to derive address from key",
  }),
);

/**
 * Build a {@link Signer} backed by a raw private key held in this process.
 *
 * Self-custody / non-OKX channel only: an on-host key is "autonomous" under
 * OKX's L-FINA policy and must not appear in the OKX-pinned tree (see
 * docs/adr/0001-okx-signing-architecture.md). A local signer is scoped to a
 * single `chainType`; the submit method for the other type returns a
 * `signing_failed` error.
 */
export function localSigner(privateKey: string, chainType: ChainType): Signer {
  return {
    kind: "local",
    resolveAddress: (caip2) =>
      chainTypeFromCaip2(caip2) === chainType
        ? toAsync(deriveAddressSafe(privateKey, chainType))
        : errAsync<string, SignerError>({ kind: "unsupported_chain", caip2 }),
    signAndSubmitEvm: (payload, rpcUrl) =>
      chainType === "evm"
        ? signAndSubmitEvm(payload, privateKey, rpcUrl)
        : errAsync<EvmSubmitResult, EvmSubmitError>({
            kind: "signing_failed",
            message: "This local signer is configured for Solana, not EVM.",
          }),
    signAndSubmitSvm: (payload, rpcUrl) =>
      chainType === "svm"
        ? signAndSubmitSvm(payload, privateKey, rpcUrl)
        : errAsync<SvmSubmitResult, SvmSubmitError>({
            kind: "signing_failed",
            message: "This local signer is configured for EVM, not Solana.",
          }),
  };
}
