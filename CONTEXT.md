# Printr — Domain Glossary

Canonical language for the Printr MCP server and SDK. Terms only — no implementation detail.
When code or conversation conflicts with a definition here, resolve the conflict before proceeding.

## Signing paths

The distinct ways a transaction built by Printr gets signed and submitted.

- **Browser signer** — the user approves each transaction in a browser wallet. Human-gated, per
  transaction. The confirmation gate OKX's scanner accepts.
- **Self-custody (keystore)** — an encrypted key the user provisions and unlocks locally; once
  unlocked, signing tools use it for the session.
- **Env-key signing** — a raw private key supplied via environment variable, used without further
  interaction.
- **Autonomous signing** — any path where signing proceeds without a per-transaction typed human
  confirmation, regardless of where the key lives.

## Trust anchor

The component that holds signing authority and that the rest of the system trusts not to leak it.
A signing path is classified by where its trust anchor sits, not by key quality.

- **On-host** — the MCP server process can reach the signing capability (env-key and keystore both
  fall here: whatever decrypts also signs). Treated as autonomous by policy.
- **TEE-backed** — the key is generated and used inside a Trusted Execution Environment and never
  leaves it; the host only submits unsigned transactions for signing.
- **Enclave-as-a-service** — a third-party (e.g. Privy) holds the key in its own enclave and signs
  on request. Off-host, but a "smart-wallet abstraction" — not OKX's endorsed anchor.

## OKX marketplace terms

- **onchainos** — OKX's TEE-backed signing service. The trust anchor OKX endorses for write-capable
  marketplace plugins. Channel-locked to OKX.
- **LTCP (Live Trading Confirmation Protocol)** — a confirmation contract a plugin's skill declares:
  preview-mode default, typed confirmation to go live, per-write preview, session limits, refuse on
  gate failure.
- **L-FINA** — OKX's security scanner. Classifies write-capable + autonomous signing (no per-write
  typed confirmation) as CRITICAL.
- **Mode B submission** — a marketplace listing that references plugin source at a pinned commit
  rather than vendoring it. The scanner reads the *entire* pinned source, not just the skill files.

## Channels

The distribution surfaces the same source serves, each with different signing constraints.

- **OKX channel** — the marketplace listing. Autonomous signing here must use onchainos + LTCP.
- **General channel** — the public `@printr/mcp` npm package. Self-custody and browser signer only
  (both human-gated). Autonomous signing is not offered here as of the OKX milestone.
