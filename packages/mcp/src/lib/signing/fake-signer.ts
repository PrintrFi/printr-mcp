import type { EvmSubmitError, EvmSubmitResult, SvmSubmitError, SvmSubmitResult } from "@printr/sdk";
import { ok, type Result } from "neverthrow";
import type { Signer, SignerError } from "./port.js";
import { toAsync } from "./to-async.js";

/**
 * Canned outcomes for a {@link fakeSigner}. Each field defaults to a deterministic
 * success; set an err `Result` to exercise a failure branch.
 */
export type FakeSignerConfig = {
  address?: Result<string, SignerError>;
  evm?: Result<EvmSubmitResult, EvmSubmitError>;
  svm?: Result<SvmSubmitResult, SvmSubmitError>;
};

const DEFAULT_ADDRESS = "0x0000000000000000000000000000000000000001";

const DEFAULT_EVM: EvmSubmitResult = {
  tx_hash: "0xfee1deadfee1deadfee1deadfee1deadfee1deadfee1deadfee1deadfee1dead0",
  block_number: "1",
  status: "success",
};

const DEFAULT_SVM: SvmSubmitResult = {
  signature: "11111111111111111111111111111111111111111111111111111111111111111111",
  slot: 1,
  confirmation_status: "confirmed",
};

/**
 * Build a deterministic in-memory {@link Signer} for tests. No network, no
 * child_process, no key material — every call resolves from {@link FakeSignerConfig}.
 * Not shipped in production wiring.
 */
export function fakeSigner(config: FakeSignerConfig = {}): Signer {
  const address = config.address ?? ok(DEFAULT_ADDRESS);
  const evm = config.evm ?? ok(DEFAULT_EVM);
  const svm = config.svm ?? ok(DEFAULT_SVM);
  return {
    kind: "fake",
    resolveAddress: () => toAsync(address),
    signAndSubmitEvm: () => toAsync(evm),
    signAndSubmitSvm: () => toAsync(svm),
  };
}
