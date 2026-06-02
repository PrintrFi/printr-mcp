# 1. Signing architecture for the OKX marketplace milestone

Date: 2026-06-02

## Status

Accepted

## Context

Printr submitted the `@printr/mcp` source to the OKX plugin store as a Mode B listing (PR #447),
which pins the entire source at a commit. OKX's L-FINA security scanner classifies any
write-capable plugin that performs **autonomous signing** — signing without a per-transaction typed
human confirmation — as CRITICAL, regardless of key quality. Because Mode B scans the whole pinned
source, every signing path present in `printr-mcp` is in scope, not just the marketplace skill.

The source ships three signing paths:

- **Env-key signing** (`EVM_WALLET_PRIVATE_KEY` / `SVM_WALLET_PRIVATE_KEY`) — autonomous, on-host.
  Also trips H07 "plaintext credentials in .env" HIGH.
- **Self-custody keystore** (`~/.printr/wallets.json`, unlocked via `printr_wallet_unlock`) —
  on-host: whatever decrypts also signs, and the agent reaches both. `printr_wallet_import`
  additionally accepts a private key as a tool input, which enters the LLM context and tool-call
  logs.
- **Browser signer** (`printr_open_web_signer`) — human-gated per transaction; the scanner accepts
  it.

A separate, deferred proposal (issue #7) would add Privy agentic wallets: autonomous server-side
signing where the key lives in Privy's enclave and the MCP host holds only `PRINTR_API_KEY`. This
moves the key off-host but remains autonomous and is an enclave-as-a-service abstraction rather than
OKX's endorsed TEE.

OKX security (Mig) directs that the endorsed pattern for write-capable plugins is onchainos
(TEE-backed signing) plus an LTCP block in the skill.

## Decision

For the OKX milestone, `@printr/mcp` offers **only human-gated signing in the general channel**, and
**onchainos as the sole autonomous path in the OKX channel** ("C-strict"):

1. Remove env-key signing (`EVM_WALLET_PRIVATE_KEY` / `SVM_WALLET_PRIVATE_KEY`) from the source,
   along with the SKILL.md wording that describes passing a private key for autonomous mode.
2. Integrate onchainos TEE signing (`onchainos wallet create`, `onchainos wallet contract-call
   --unsigned-tx`) as the autonomous path for the OKX channel. Calldata is still built in the
   plugin; signing is delegated to the TEE.
3. Add an LTCP block immediately after the SKILL.md frontmatter.
4. Keep `printr_open_web_signer` as the human-gated fallback for users without onchainos.
5. **Defer Privy (issue #7).** Onchainos covers Privy's security and automation motivations for the
   OKX channel, and Privy would not clear L-FINA in the pinned source (autonomous + non-endorsed
   anchor). Revive only if gas sponsorship or non-OKX automation becomes a product requirement.

## Open question (gates keystore handling)

Mig's stated rule implies the self-custody keystore also fails L-FINA, because the agent process
holds the decryption capability. This must be confirmed with Mig before scope is final:

- If keystore fails: it must be removed from the pinned tree. Self-custody then moves to a separate,
  non-OKX package that OKX never pins.
- If the `unlock` step counts as per-session human confirmation and passes: keystore stays in the
  source as a human-gated self-custody path.

## Consequences

- The OKX-pinned source presents the smallest honest surface that can clear L-FINA: no on-host
  autonomous signing, onchainos for autonomous use, browser signer for fallback.
- The general npm channel loses autonomous signing as of this milestone. Users wanting unattended
  signing outside OKX have no supported path until #7 (or equivalent) is revived.
- A single source serves both channels; no build-variant divergence is introduced. The cost is
  feature loss in the general channel rather than maintenance of two trees.
- Adopting onchainos creates a hard dependency on OKX's CLI for the OKX channel's autonomous path.
- The keystore question above may expand the removal scope; treat it as blocking before
  implementation begins.
