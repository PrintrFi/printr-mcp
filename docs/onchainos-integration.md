# OnchainOS integration reference

Research notes for migrating Printr's autonomous signing to OKX onchainos (per ADR 0001). Sourced
from OKX docs and the reference plugins in the OKX plugin-store (lido = EVM; kamino / raydium /
meteora = Solana), which use onchainos in production.

## What onchainos is

OKX Agentic Wallet / OnchainOS — a TEE-backed signing service for AI agents.

- Wallet provisioned via `onchainos wallet login <email>`; created instantly, no seed phrase. Keys
  are generated, stored, and signed entirely inside a TEE and never leave it. Up to 50 derived
  sub-wallets.
- Ships as both a CLI binary and an MCP server. Installed from `okx/onchainos-skills` (GitHub
  releases, SHA-verified). Reference plugins auto-inject the install into SKILL.md pre-flight.
- Production auth needs OKX Developer Portal credentials (`OKX_API_KEY` / `OKX_SECRET_KEY` /
  `OKX_PASSPHRASE`); sandbox keys exist for testing.
- Performs transaction risk simulation + scoring before execution.

## CLI surface (observed in reference plugin source)

```
onchainos wallet login <email>                 # provision / auth
onchainos wallet addresses [--chain <id>]      # resolve active address
onchainos wallet balance --chain <id>          # balances
onchainos wallet history                        # poll tx status (SUCCESS / FAILED)
onchainos wallet contract-call \               # the signing call
  --biz-type dapp --strategy <plugin-name> \
  --chain <id> --to <addr> \
  # EVM:    --input-data <hex> [--amt <wei>] [--from <addr>]
  # Solana: --unsigned-tx <base58> --force
  [--force]                                     # broadcast (omit = onchainos-side simulate)
```

- EVM: calldata via `--input-data`, native value via `--amt` (wei). Returns `data.txHash`.
- Solana (chain id `501`): full serialized tx via `--unsigned-tx` in base58 (Solana APIs return
  base64 → convert first); `--force` is required to broadcast.
- Reads do not go through onchainos — plugins call public RPC directly (`eth_call`). onchainos
  `contract-call` has no read-only mode.
- `--biz-type dapp` + `--strategy <plugin-name>` are attribution to the onchainos backend.

## Confirmation model (LTCP)

Two layers, matching Printr's existing preview/sign split:

1. Plugin layer — every write previews by default; broadcasts only with `--confirm`. This is the
   LTCP gate the L-FINA scanner reads in SKILL.md (~14 lines, near top).
2. onchainos layer — `--force` is what flips simulate → broadcast.

## Integration shapes for printr-mcp

Printr already returns unsigned transactions (`create-token.ts`), so the seam is clean. onchainos is
implemented as one **adapter behind the `Signer` port** (see ADR 0002) — not wired directly into the
signing tools.

- Shape 1 (recommended, marketplace-compliant): an `onchainosSigner` adapter that shells out via
  child_process — `resolveAddress()`, `signAndSubmit()` — mirroring the reference `onchainos.rs`.
  The signing tools (`sign-and-submit-evm.ts` / `sign-and-submit-svm.ts`) depend on the `Signer`
  port, not on onchainos; the adapter is selected by the wallet-resolution tag. SVM needs the
  assemble/sign split (already flagged in issue #7) plus base64→base58 conversion. Self-contained
  skill, same as every endorsed plugin.
- Shape 2 (lighter, riskier): compose two MCP servers — Printr emits the unsigned tx, the agent
  hands it to onchainos's MCP contract-call tool. No onchainos code in Printr, but not
  self-contained and unlike any reference plugin, so weaker for review.

## Open risks / unknowns (gate the migration — confirm with Mig)

1. Chain coverage (biggest). Confirmed: Ethereum, Solana, Base, BSC, Arbitrum, Polygon, XLayer.
   NOT confirmed: Avalanche, Unichain, Monad, Hyperliquid, Mantle — all chains Printr lists. If
   unsupported, those chains have no autonomous path post-migration (browser-signer only).
2. Auth friction. `onchainos wallet login <email>` is interactive and needs OKX Dev Portal creds —
   awkward for a headless / CI MCP, the same gap #7 raised about `open_web_signer`.
3. GA vs beta — docs do not say.
4. Fee / attribution — whether `--biz-type` / `--strategy` carry a fee cut or are attribution only.

## Sources

- https://web3.okx.com/onchainos/dev-docs/home/what-is-onchainos
- https://web3.okx.com/onchainos/dev-docs/wallet/agentic-wallet
- https://github.com/okx/onchainos-skills
- Reference plugins: okx/plugin-store `skills/{lido,kamino-lend,raydium,meteora}-plugin`
