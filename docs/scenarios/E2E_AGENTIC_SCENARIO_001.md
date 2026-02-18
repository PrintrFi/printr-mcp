# E2E Agentic Scenario 001 — Token Launch Advisor (Solana, Generated Details)

## Overview

A founder uses the **Token Launch Advisor** system prompt to launch a token on Solana.
All token details are AI-generated; the only real input is the founder's wallet address.
The scenario exercises the full advisory flow: identity → chain selection → parallel quote
comparison → strategy confirmation → `printr_create_token` → deployment polling.

---

## System Prompt

Use the token launch advisor system prompt verbatim:

```
You are a token launch advisor powered by the Printr MCP server.
Your job is to guide a founder through launching a token on-chain — from
strategy to a ready-to-sign transaction payload.

## Flow

1. Gather token identity (name, symbol, description, image)
2. Gather chain and wallet info
3. Gather initial buy strategy
4. Call `printr_quote` with all candidate strategies in parallel
5. Present a cost comparison and recommendation
6. Confirm the chosen strategy with the founder
7. Call `printr_create_token` with the confirmed inputs
8. Return the unsigned transaction payload with clear signing instructions
9. Once the founder confirms the tx was submitted, poll `printr_get_deployments`
   until all chains show `live` or `failed`
...
```

*(Include full system prompt as used in the Claude Code conversation.)*

---

## Inputs (User Turns)

| Turn | User Message |
|------|--------------|
| 1 | `make up token details` |
| 2 | `ok, this is my solana address: Ez4hEGekBmzgYYgDuwXW68LNzRUdHSTU1A1CLvLyumjR` |
| 3 | `lets use only solana` |
| 4 | `make up those too pls` *(buy strategy + graduation threshold)* |
| 5 | `confirm` *(after reviewing quote comparison)* |

---

## Generated Token Identity

| Field | Value |
|-------|-------|
| **Name** | Neon Drift |
| **Symbol** | $DRIFT |
| **Description** | Speed, style, and on-chain culture. Neon Drift is a token for the night riders — powering underground sim leagues, real-world track events, and a community built around going fast. Floor it or get left behind. |
| **Image** | *(skipped — no image provided)* |
| **External links** | None |

---

## Chain & Wallet

| Field | Value |
|-------|-------|
| **Chain** | Solana (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`) |
| **Creator wallet** | `Ez4hEGekBmzgYYgDuwXW68LNzRUdHSTU1A1CLvLyumjR` |

---

## MCP Tool Calls

### Step 1 — Parallel quotes (two strategies)

Both calls are made **in parallel** before presenting results.

**Call A — 1% of supply**
```json
{
  "tool": "printr_quote",
  "arguments": {
    "chains": ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
    "initial_buy": { "supply_percent": 1 },
    "graduation_threshold_per_chain_usd": 69000
  }
}
```

**Call B — $100 USD fixed**
```json
{
  "tool": "printr_quote",
  "arguments": {
    "chains": ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
    "initial_buy": { "spend_usd": 100 },
    "graduation_threshold_per_chain_usd": 69000
  }
}
```

**Observed results (2026-02-19, SOL ≈ $81.27)**

| | Strategy A — 1% supply | Strategy B — $100 USD |
|---|---|---|
| Initial buy cost | ~$58.08 (0.7146 SOL) | ~$100.00 (1.2304 SOL) |
| Deployment fee | $0.00 | $0.00 |
| Gas | ~$1.93 | ~$1.93 |
| **Total** | **~$60.02** | **~$101.93** |
| Tokens received | 10,000,000 $DRIFT | 0 *(API edge case)* |

**Recommendation:** Strategy A. Lower cost, explicit token allocation, Strategy B returned
`initial_buy_amount: "0"` at current SOL pricing.

---

### Step 2 — Create token (after founder confirms Strategy A)

> **Note:** `printr_create_token` must NOT be called before explicit founder confirmation.
> Quote IDs expire after ~5 minutes — re-quote if confirmation is delayed.

```json
{
  "tool": "printr_create_token",
  "arguments": {
    "name": "Neon Drift",
    "symbol": "DRIFT",
    "description": "Speed, style, and on-chain culture. Neon Drift is a token for the night riders — powering underground sim leagues, real-world track events, and a community built around going fast. Floor it or get left behind.",
    "image": "<base64-encoded JPEG or PNG — required for real run>",
    "chains": ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
    "creator_accounts": ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:Ez4hEGekBmzgYYgDuwXW68LNzRUdHSTU1A1CLvLyumjR"],
    "initial_buy": { "supply_percent": 1 },
    "graduation_threshold_per_chain_usd": 69000
  }
}
```

Expected response fields: `id` (telecoin ID), `transaction` (unsigned payload).
The transaction must be labeled **UNSIGNED** and the founder must sign + submit it themselves.

---

### Step 3 — Poll deployments (after founder submits tx)

Poll until all chains show `live` or `failed`.

```json
{
  "tool": "printr_get_deployments",
  "arguments": {
    "id": "<telecoin-id-from-create-response>"
  }
}
```

Expected: each entry in `deployments` has `status` of `live` or `failed`.
If `failed`, surface the affected chain and suggest next steps to the founder.

---

## Assertions / Acceptance Criteria

- [ ] Agent generates all token details without prompting when user says "make up"
- [ ] Agent requests wallet address even when generating other details
- [ ] Agent quotes **at least two strategies in parallel** before recommending
- [ ] Agent clearly labels recommended strategy with reasoning
- [ ] Agent does NOT call `printr_create_token` until user explicitly confirms
- [ ] Unsigned transaction payload is clearly labeled as **UNSIGNED**
- [ ] Agent polls `printr_get_deployments` after founder confirms submission
- [ ] Agent surfaces `failed` deployments with next-step guidance

---

## Notes & Known Edge Cases

- **Strategy B ($100 USD) returns `initial_buy_amount: "0"`** — this appears to be a pricing
  edge case in the preview API at certain SOL/USD rates. Strategy A (supply %) is more reliable.
- **Image is required** for `printr_create_token` in a real run. This scenario skips the image;
  a real reproduction must supply a base64-encoded JPEG/PNG under 500KB.
- Quote IDs expire. If the founder takes more than ~5 minutes to confirm, re-run the quote step.
