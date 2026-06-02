import type { ChainType } from "@printr/sdk";
import { err, ok, type Result } from "neverthrow";
import { match } from "ts-pattern";
import { type FakeSignerConfig, fakeSigner } from "./fake-signer.js";
import { localSigner } from "./local-signer.js";
import { type OnchainosDeps, onchainosSigner } from "./onchainos-signer.js";
import type { Signer, SignerError } from "./port.js";

/**
 * A tagged description of which signing backend to use, decoupled from how it is
 * discovered. A resolver (env, active wallets, OKX channel detection) produces a
 * descriptor; {@link selectSigner} turns it into a {@link Signer}.
 *
 * Add a backend by adding a variant here, an adapter, and a `.with` arm below —
 * the exhaustive match makes a missing arm a compile error. (browser / privy
 * adapters are tracked as follow-ups; see docs/adr/0002-signing-ports-and-adapters.md.)
 */
export type SignerDescriptor =
  | { kind: "local"; privateKey: string; chainType: ChainType }
  | { kind: "onchainos" }
  | { kind: "fake"; config?: FakeSignerConfig };

/** External dependencies needed to construct certain adapters. */
export type SelectSignerDeps = {
  onchainos?: OnchainosDeps;
};

/**
 * Resolve a {@link SignerDescriptor} to a concrete {@link Signer}.
 *
 * Returns an `err` only when a required dependency is absent (e.g. an onchainos
 * descriptor with no onchainos deps wired); adapter construction itself is total.
 */
export function selectSigner(
  descriptor: SignerDescriptor,
  deps: SelectSignerDeps = {},
): Result<Signer, SignerError> {
  return match(descriptor)
    .with({ kind: "local" }, (d) => ok(localSigner(d.privateKey, d.chainType)))
    .with({ kind: "fake" }, (d) => ok(fakeSigner(d.config)))
    .with({ kind: "onchainos" }, () =>
      deps.onchainos
        ? ok(onchainosSigner(deps.onchainos))
        : err<Signer, SignerError>({
            kind: "resolution_failed",
            message: "onchainos signer requested but no onchainos dependencies were provided.",
          }),
    )
    .exhaustive();
}
