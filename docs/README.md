# Printr docs

Design notes, architecture decisions, and integration references for the Printr monorepo.

For day-to-day development start with the root docs:

- [`README.md`](../README.md) — project overview
- [`INSTALL.md`](../INSTALL.md) — installation and setup
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — local dev, conventions, hooks, PRs
- [`AGENTS.md`](../AGENTS.md) — monorepo map, structure, patterns
- [`CONTEXT.md`](../CONTEXT.md) — domain glossary (canonical terms)

## Architecture decisions (ADRs)

- [0001 — Signing architecture for the OKX marketplace milestone](./adr/0001-okx-signing-architecture.md)
- [0002 — Signing backends as functional ports and adapters](./adr/0002-signing-ports-and-adapters.md)

## Design & integration references

- [OnchainOS integration reference](./onchainos-integration.md) — OKX TEE-backed signing CLI surface
- [Deployment wallet recovery design](./deployment-wallet-recovery-design.md)
- [Consumer integration analysis: printr-mcp ↔ memeprintr](./consumer-integration-analysis.md)
