# 2. Signing backends as functional ports and adapters

Date: 2026-06-02

## Status

Accepted

## Context

ADR 0001 commits onchainos as the autonomous signing path for the OKX channel and keeps the browser
signer as the human-gated fallback. It also leaves the door open to other backends (Privy per issue
#7, future TEE providers) in non-OKX channels. We do not want onchainos — or any single vendor —
baked into the signing call sites. We also want the signing logic to be unit-testable without a real
TEE, CLI, or network, and the preview path to be deterministic so the LTCP gate can be reasoned
about and tested.

The codebase already hints at this seam: `resolveWallet` returns a `WalletResolution` discriminated
union (`packages/mcp/src/lib/wallet-elicit.ts`) and `ActiveWallet` is a tagged union
(`packages/mcp/src/server/wallet-sessions.ts`). Issue #7 proposed adding variants to exactly these
unions. Each signing backend is, in effect, an adapter selected by the resolution tag.

## Decision

Model signing as a **functional port with swappable adapters**, following the project's
neverthrow / ts-pattern conventions (see `alanstack`).

### The port (a function-shaped type, not a class)

```ts
/** A signing backend: resolves the active address and submits transactions for a chain. */
type Signer = {
  resolveAddress: (chain: ChainId) => ResultAsync<Address, SignError>;
  signAndSubmit: (req: SignRequest) => ResultAsync<TxReceipt, SignError>;
};
```

- All fallible operations return `ResultAsync` — no throws across the port boundary.
- `SignRequest` carries the already-built, unsigned payload (calldata for EVM, serialized tx for
  SVM). Building calldata stays in Printr's pure core; the port only signs and submits.

### Adapters (one per backend)

- `onchainosSigner` — shells out to the onchainos CLI (`wallet contract-call`). OKX channel.
- `browserSigner` — the existing `printr_open_web_signer` flow. Human-gated fallback.
- `keystoreSigner`, `privySigner` — deferred; non-OKX channel only, never in the OKX-pinned tree
  unless they independently clear L-FINA (see ADR 0001).
- `fakeSigner` — in-memory, deterministic; used by tests. Not shipped.

### Selection

A single resolution function maps the `WalletResolution` / `ActiveWallet` tag to an adapter via
`ts-pattern` `.match(...).exhaustive()`. Adding a backend = adding a union variant + an adapter +
one match arm; the compiler forces the arm to exist. Call sites
(`sign-and-submit-evm.ts`, `sign-and-submit-svm.ts`, `create-token.ts`, `launch-token.ts`) depend on
the `Signer` port, never on a concrete backend.

### Dependency abstraction and determinism

- Adapters are injected at the tool-registration boundary, not imported deep in the core. The pure
  core (calldata assembly, preview rendering, LTCP gating) takes a `Signer` as a parameter.
- Side effects (child_process, fetch, RPC) live only inside adapters. The core is pure and
  deterministic: the same `SignRequest` yields the same preview, with no broadcast.
- The preview / submit split maps cleanly: preview is a pure function over the request; submit is the
  adapter's single side-effecting step (gated by `--confirm` at the plugin layer, `--force` at the
  onchainos layer).

## Consequences

- Backends are pluggable without touching call sites; onchainos is the first adapter, not the
  architecture. No vendor lock-in.
- Signing logic is unit-testable with `fakeSigner` — fast, deterministic, no TEE/CLI/network. Tests
  assert on `Result` values, not mocks of our own functions.
- Exhaustiveness checking makes "did we handle every backend on every chain" a compile error rather
  than a runtime surprise.
- The OKX-channel constraint from ADR 0001 still holds at the *adapter* level: only TEE-backed or
  human-gated adapters may be present in the pinned tree. The port does not relax the scanner rule;
  it just isolates each backend behind a testable boundary.
- Small upfront cost: defining the port and refactoring the signing tools to depend on it before the
  onchainos adapter lands.
