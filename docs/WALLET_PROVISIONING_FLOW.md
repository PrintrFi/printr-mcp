# Wallet Provisioning Flow

When a sign tool is invoked without an explicit `private_key` argument, the MCP server
guides the user through wallet selection or provisioning via MCP elicitation and the
local session server — so a private key **never enters the LLM context window**.

---

## Design principles

| Principle | Rationale |
|---|---|
| **Private keys never enter chat** | Even on local stdio, the MCP host logs conversations and may sync them to the cloud. Keys shown in tool responses would enter the model's context and could be echoed in summaries or future turns. |
| **Browser is the secure boundary** | The existing session server acts as a local secret store. Key display, key input, and password entry all happen in a browser page served from `127.0.0.1` — never through the LLM. |
| **Elicitation collects action only** | The `elicitInput` call asks the user to choose an action. No sensitive data passes through MCP protocol messages. |
| **Balance verified before signing** | Before signing, the wallet's on-chain native balance is checked. Signing is only attempted if there are sufficient funds to cover fees. |
| **Encrypted persistence** | Wallets are saved to a local keystore file, encrypted with AES-256-GCM + scrypt. The address is stored plaintext; the private key is not. The user never needs to re-enter or re-fund after an MCP restart. |
| **AGENT_MODE for automation** | When `AGENT_MODE=1`, all elicitation and browser flows are skipped. The server uses env vars exclusively and errors immediately if no key is configured. |

---

## Modes

### Interactive mode (default)

Full elicitation + browser-based key handling. Intended for human-in-the-loop use with
Claude Desktop, Cursor, or any MCP client that renders elicitation prompts.

### AGENT_MODE (`AGENT_MODE=1`)

Headless mode for automated pipelines (CI, agent-to-agent, scripts). No elicitation, no
browser redirects, no wallet provisioning.

Key resolution in AGENT_MODE:

```
private_key in tool input → use it
EVM_WALLET_PRIVATE_KEY / SVM_WALLET_PRIVATE_KEY env var → use it
neither → error:
  "No wallet configured. In AGENT_MODE, set EVM_WALLET_PRIVATE_KEY
   or SVM_WALLET_PRIVATE_KEY, or pass private_key in the tool call."
```

---

## Entry condition

Elicitation fires whenever `private_key` is **absent from the tool input** and
`AGENT_MODE` is not set — even when a key is already known via env var or keystore.
Passing `private_key` explicitly always bypasses the flow entirely.

---

## Step 1 — Elicit action (via MCP `elicitInput`)

The elicitation always fires in interactive mode. The options presented depend on whether
any wallets are already stored in the keystore.

**Stored wallets exist for this chain:**

```
"Choose a wallet to sign on {chain}:"

  ◉ My Base Wallet   — 0xabc...def
  ○ Trading Wallet   — 0x123...456
  ○ Provide a key    — enter an existing key
  ○ Generate new     — create and save a new wallet
```

**No stored wallets:**

```
"No wallets configured for {chain}. How would you like to sign?"

  ○ Provide a key    — enter an existing key
  ○ Generate new     — create and save a new wallet
```

`result.action` is one of `accept | decline | cancel`. On decline or cancel the tool
returns an error immediately.

---

## Step 2 — Browser-based key and password handling

All key material and passwords are handled through routes on the local session server,
using the same session token pattern as the web signer flow.

### Use stored wallet — password prompt

Opens `GET /wallet/unlock?token=...`. User enters the keystore password in the browser.
The session server decrypts the wallet entry, performs the balance check, and returns the
result to the tool handler.

### "Provide a key" — `GET /wallet/provide?token=...`

The session server serves a key-input form. After the user enters the key:

1. Validate key format (EVM hex / SVM base58)
2. Derive public address
3. Check on-chain balance
4. **Offer to save:** "Save this wallet to your keystore?" → if yes, prompt for label + password

```
POST /wallet/provide/:token
Body: { private_key, save?: boolean, label?: string, password?: string }

→ validate → balance check
  ├─ sufficient + save  → encrypt → append to keystore → store in session → sign
  ├─ sufficient + no save → store in session only (ephemeral) → sign
  ├─ insufficient       → return funding instructions (key stored in session anyway)
  └─ invalid key        → error (no retry)
```

### "Generate new" — `GET /wallet/new?token=...`

Keypair is generated server-side. The browser shows a one-time display page:

1. Public address (safe to copy)
2. Private key — shown once, behind a "reveal" toggle
3. "I have backed up my private key" checkbox (required to continue)
4. Wallet label input + password input (required — generated wallets are always saved)

```
POST /wallet/new/:token/confirm
Body: { confirmed: true, label: string, password: string }

→ encrypt private key with password → append to keystore
→ mark session as confirmed
→ return { ok: true, address }
```

Generated wallets are always saved to the keystore — there is no ephemeral option,
since the user has just been shown the key and must back it up anyway.

---

## Encrypted keystore

### File location

Default: `~/.printr/wallets.json`
Override: `PRINTR_WALLET_STORE=/path/to/wallets.json`

### Format

```json
{
  "version": 1,
  "wallets": [
    {
      "id": "uuid-v4",
      "label": "My Base Wallet",
      "chain": "eip155:8453",
      "address": "0xabc...def",
      "kdf": "scrypt",
      "kdfParams": { "N": 131072, "r": 8, "p": 1, "dkLen": 32 },
      "salt": "<base64>",
      "iv": "<base64>",
      "encryptedKey": "<base64>",
      "createdAt": 1234567890
    }
  ]
}
```

- `address` — stored plaintext so the elicitation list can display it without decrypting
- `encryptedKey` — AES-256-GCM ciphertext of the raw private key string
- `salt` + `kdfParams` — scrypt parameters, unique per wallet entry
- `iv` — GCM nonce, unique per encryption
- No password or derived key is ever written to disk

### Encryption (Node.js built-ins only, no new deps)

```
key = scrypt(password, salt, kdfParams)
{ ciphertext, authTag } = AES-256-GCM.encrypt(privateKey, key, iv)
encryptedKey = base64(ciphertext + authTag)
```

### Multiple wallets

- Wallets are stored per-chain and labelled by the user
- The elicitation list shows all wallets whose `chain` matches the current sign request
- A wallet from a different chain is never offered as a choice
- "Provide a key" and "Generate new" always append a new entry — they do not overwrite
- There is no explicit delete flow in v1 (users can edit the JSON file directly)

---

## Balance check

Performed before signing on all paths (stored, provided, generated-then-re-invoked).

| Chain | Method | Minimum |
|---|---|---|
| EVM | `viem` public client `getBalance(address)` | `gas_limit × estimated_gas_price` (from payload) |
| SVM | `@solana/web3.js` `connection.getBalance(pubkey)` | ~5 000 lamports |

RPC endpoint priority: tool input `rpc_url` → env var `PRINTR_RPC_{CHAIN_ID}` → default
public RPC for the chain.

On insufficient balance the tool returns:

```
Wallet {address} on {chain} has insufficient {symbol}.
Balance:  {current} {symbol}
Required: ~{estimated} {symbol}

Fund the wallet and try again.
```

---

## Full decision tree

```
sign tool invoked
│
├─ private_key in tool input?
│    └─ yes → use it directly, skip all below
│
├─ AGENT_MODE=1?
│    ├─ env var key present → use it
│    └─ no env var          → error: "Set EVM/SVM_WALLET_PRIVATE_KEY or pass private_key"
│
└─ interactive mode → elicitInput
    │
    ├─ decline / cancel
    │    └─ error: "Wallet required to sign."
    │
    ├─ stored wallet selected
    │    → open browser: GET /wallet/unlock?token=...
    │    → user enters password → decrypt
    │    → balance check
    │      ├─ sufficient  → sign → done
    │      └─ insufficient → error with funding instructions
    │
    ├─ "provide a key"
    │    → open browser: GET /wallet/provide?token=...
    │    → user enters key (+ optional save: label + password)
    │    → validate + balance check
    │      ├─ valid + sufficient  → (save if requested) → sign → done
    │      ├─ valid + insufficient → (save if requested) → error with funding instructions
    │      └─ invalid key          → error (no retry)
    │
    └─ "generate new"
         → generate keypair server-side
         → open browser: GET /wallet/new?token=...
         → user sees address + key (one-time), sets label + password
         → user confirms backup
         → encrypt + save to keystore
         → tool returns WITHOUT signing:
              ┌──────────────────────────────────────────────┐
              │  New {chain} wallet created and saved        │
              │                                              │
              │  Label:   {label}                            │
              │  Address: {address}                          │
              │                                              │
              │  ⚠ Your private key was shown once in the   │
              │    browser. It is now encrypted in your      │
              │    keystore. Back up the keystore file:      │
              │    {keystore_path}                           │
              │                                              │
              │  Fund it with {symbol} on {chain},           │
              │  then ask me to sign again.                  │
              └──────────────────────────────────────────────┘
         ← user funds externally ←
         user asks agent to sign again
         → elicitation shows "{label} — {address}" pre-selected
         → password prompt → balance check passes → sign → done
```

---

## Chain metadata

Derived from `../printr/web/app/stores/chains/defs.ts` (source of truth). A lightweight
static copy lives in `src/lib/chains.ts` — no React dependency.

| CAIP-2 | Name | Symbol | Decimals |
|---|---|---|---|
| `eip155:1` | Ethereum | ETH | 18 |
| `eip155:56` | BNB | BNB | 18 |
| `eip155:130` | Unichain | ETH | 18 |
| `eip155:143` | Monad | MON | 18 |
| `eip155:999` | HyperEVM | HYPE | 18 |
| `eip155:5000` | Mantle | MNT | 18 |
| `eip155:6342` | MegaETH | ETH | 18 |
| `eip155:8453` | Base | ETH | 18 |
| `eip155:9745` | Plasma | XPL | 18 |
| `eip155:42161` | Arbitrum | ETH | 18 |
| `eip155:43114` | Avalanche | AVAX | 18 |
| `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | Solana | SOL | 9 |

---

## New session server routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/wallet/unlock?token=...` | Password prompt for a stored wallet |
| `POST` | `/wallet/unlock/:token` | Receive password, decrypt, balance-check |
| `GET` | `/wallet/provide?token=...` | Key-input form (+ optional save) |
| `POST` | `/wallet/provide/:token` | Receive key, validate, balance-check, optionally save |
| `GET` | `/wallet/new?token=...` | One-time keypair display + label + password form |
| `POST` | `/wallet/new/:token/confirm` | Receive confirmation + label + password, encrypt, save |

---

## Environment variables

| Variable | Description |
|---|---|
| `AGENT_MODE` | Set to `1` or `true` to skip all elicitation and browser flows |
| `PRINTR_WALLET_STORE` | Path to the keystore JSON file (default: `~/.printr/wallets.json`) |
| `PRINTR_RPC_{CHAIN_REF}` | Default RPC for balance checks, e.g. `PRINTR_RPC_8453` for Base |

---

## What needs to be built

| Component | File | Notes |
|---|---|---|
| Chain metadata | `src/lib/chains.ts` | Static map derived from web app defs |
| Keystore read/write | `src/lib/keystore.ts` | AES-256-GCM + scrypt via `node:crypto` |
| Balance checker | `src/lib/balance.ts` | `viem` for EVM, `@solana/web3.js` for SVM |
| Wallet elicitation helper | `src/lib/wallet-elicit.ts` | Shared logic called by both sign tools |
| Wallet session routes | `src/server/app.ts` | 6 new routes |
| Browser pages | `src/server/pages/wallet-unlock.html` | Password prompt |
|               | `src/server/pages/wallet-provide.html` | Key input + optional save |
|               | `src/server/pages/wallet-new.html` | One-time key display + label + password |
| `AGENT_MODE` env var | `src/lib/env.ts` | Boolean flag |
| Updated sign tools | `src/tools/sign-and-submit-evm.ts` | Call elicitation helper when no key in input |
|                    | `src/tools/sign-and-submit-svm.ts` | Same |
