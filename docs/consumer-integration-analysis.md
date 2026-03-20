# Consumer Integration Analysis: printr-mcp ↔ memeprintr

Analysis of inconsistencies, antipatterns, and ambiguities between the printr-mcp provider and
the memeprintr consumer. Ordered by severity.

---

## Critical Issues

### 1. Auto-drain failures are silent

**Files:** `packages/mcp/src/tools/launch-token.ts:198-204`

`autoDrainSvmWallet` uses `.catch()` to swallow errors:

```ts
await drainSvm(...).catch((e: unknown) => {
  logger.warn({ error: ... }, "Auto-drain after launch failed");
});
```

If drain fails (RPC timeout, network error), the tool still returns `status: "submitted"`. The
consumer has no signal that funds are stuck. The deployment agent is explicitly told _not_ to call
`printr_drain_deployment_wallet`, so there is no recovery path — funds remain in the deployment
wallet indefinitely.

**Fix:** Add a `drain_status` field to the `printr_launch_token` output schema (`"ok"` |
`"failed"` | `"skipped"`). Surface drain errors in the response so the consumer can trigger
manual recovery via `printr_drain_deployment_wallet` with the explicit `wallet_id`.

---

### 2. `initial_buy: { spend_usd: 0 }` is invalid but instructed

**Files:** `memeprintr/src/mastra/workflows/deployment.ts:293`,
`memeprintr/src/mastra/agents/deployment.ts:46`

The memeprintr deployment agent is instructed to pass `initial_buy: { spend_usd: 0 }` as a
default no-buy. But the consumer's own schema requires `spendUsd` to be `.positive()` (> 0).
`spend_usd: 0` is rejected by that validation before it ever reaches the MCP tool. The API
also rejects zero-value buys.

**Fix:** Remove the `initial_buy: { spend_usd: 0 }` instruction from both the agent system prompt
and the workflow. Omit `initial_buy` entirely for no-buy — the SDK and API both accept its absence
as "no buy". Update the agent prompt to say: _"Omit `initial_buy` entirely if no buy is intended;
never pass `spend_usd: 0`."_

---

### 3. Wallet recovery contract is implicit and unidirectional

**Files:** `packages/mcp/src/tools/drain-deployment-wallet.ts:56-141`,
`memeprintr/src/mastra/agents/deployment.ts`,
`memeprintr/src/services/launch/deployment.ts`

The drain tool has a four-tier wallet resolution strategy (explicit ID → in-memory → persisted
active → last deployment ID). The consumer never passes an explicit `wallet_id`, so it relies
entirely on MCP internal state. If the MCP process restarts mid-deployment and persisted state
is lost, the deployment wallet becomes unrecoverable from the consumer side.

There is no recovery workflow in memeprintr. The deployment agent stores `wallet_id` in its output
schema but neither the workflow nor the service layer ever uses it to trigger an explicit drain on
failure.

**Fix:** The workflow and service layer should persist `wallet_id` from `printr_fund_deployment_wallet`
output and pass it explicitly to `printr_drain_deployment_wallet` in all error and cleanup paths.
This makes recovery independent of MCP in-memory state and survives process restarts.

---

## High Issues

### 4. Fee collection schema uses mismatched field names

**Files:** `memeprintr/src/scheduler/jobs/fee-collection.ts:37-59`,
`packages/mcp/src/tools/claim-fees.ts` (output schema)

The consumer's structured output schema expects camelCase:

```ts
{ tokenId, chain, amountUsd, txSignature }
```

The MCP tool returns snake_case:

```ts
{ token_id, chain, claimed_amount_usd, claimed_amount_native, native_symbol, tx_hash, tx_signature }
```

The LLM must translate between these ad hoc. This is unreliable — models sometimes pass through
field names verbatim, causing Zod parse failures that silently fall through to the fallback value
of `{ claimsExecuted: [] }`. When that happens, the job records zero claims as if nothing was
claimable, losing audit trail of actual on-chain activity.

**Fix:** Align the consumer's structured output schema with the tool's actual output shape. Replace
the camelCase fields with snake_case to match: `token_id`, `claimed_amount_usd`, `tx_signature`.
Alternatively, add an explicit post-processing transformation before Zod parse rather than relying
on the LLM to rename fields.

---

### 5. Password validation is asymmetric

**Files:** `memeprintr/src/mastra/preflight.ts:69-86`,
`packages/mcp/src/tools/fund-deployment-wallet.ts:44-50`

memeprintr validates password weakness patterns at startup (all-same-char, sequential numbers,
"password", "admin" prefix). The MCP server only checks minimum length (16 chars). A password
that passes MCP validation may be rejected by memeprintr preflight — but only on startup, not
at fund time. If the env var is changed after startup, weak passwords can reach the MCP server
undetected.

**Fix:** Move the pattern validation into the MCP server (the provider owns the security contract).
The consumer's preflight can remain as an early-warning layer but should not be the only gate.

---

### 6. EVM treasury classified as warning when it may be critical

**Files:** `memeprintr/src/mastra/preflight.ts:113`

The preflight marks a missing `TREASURY_EVM_PRIVATE_KEY` as severity `"warning"` with the comment
"primarily use Solana". If a deployment workflow targets EVM chains (Base, Arbitrum, etc.), the
missing key causes a runtime error deep inside the MCP tool — not a startup failure. The user
gets no early warning that EVM deployments will fail.

**Fix:** Classify EVM key absence as an error when configured chains include EVM namespaces, or
surface it as a warning that includes the consequence: _"EVM chain deployments will fail at
runtime."_ The message should name which chains are affected.

---

## Medium Issues

### 7. Unclear contract: activeWalletId vs lastDeploymentWalletId

**Files:** `packages/mcp/src/tools/fund-deployment-wallet.ts:224-232`,
`packages/mcp/src/tools/drain-deployment-wallet.ts:242-248`

`fund-deployment-wallet` sets both `activeWalletId` and `lastDeploymentWalletId` to the same
wallet ID. `drain-deployment-wallet` clears both. The distinction between the two is undocumented.
The four-tier resolution in `resolveWallet()` treats them as different fallbacks, implying they
can diverge — but no code path currently creates that divergence. This is dead complexity that
will confuse future maintainers and may mask bugs if the semantics are ever separated.

**Fix:** Either document the intended distinction (e.g., `activeWalletId` = currently in use,
`lastDeploymentWalletId` = most recent regardless of active state) and enforce it, or collapse
them into a single field.

---

### 8. Image generation may run twice per deployment

**Files:** `memeprintr/src/mastra/workflows/deployment.ts:283-293`,
`packages/mcp/src/tools/launch-token.ts:47-59`

The memeprintr workflow instructs the agent to:
1. Call `printr_generate_image` and save the `image_path`
2. Pass `image_path` to `printr_launch_token`

But `printr_launch_token` itself auto-generates an image when neither `image` nor `image_path` is
provided and `OPENROUTER_API_KEY` is set. If the agent fails to pass `image_path` correctly
(mistaken name, wrong value), the tool silently generates a second image. The token may launch
with a different image than what the agent reported. There is no field in the tool response
indicating which image was used or how it was sourced.

**Fix:** Add an `image_source` field to the `printr_launch_token` response schema: `"provided"` |
`"generated"` | `"none"`. In the workflow, treat a missing or empty `image_path` from the
`printr_generate_image` step as a hard error rather than a silent fallback.

---

### 9. Multi-chain deployments: creator_accounts inference only covers active wallet address

**Files:** `packages/mcp/src/tools/launch-token.ts:234-236`

`creator_accounts` is inferred as:

```ts
tokenParams.chains.map((chain) => `${chain}:${activeWallet.address}`)
```

This assumes one address handles all chains. That's correct for a single-keypair deployment, but
the API type (`creator_accounts: string[]`) allows one address per chain. If a user has separate
EVM and SVM addresses, the inference silently uses the wrong address for some chains. There is no
validation or warning.

**Fix:** For deployments spanning both EVM and SVM namespaces, require explicit `creator_accounts`
rather than inferring. Add a validation step that warns (or errors) when the inferred accounts
span multiple namespaces with a single address, prompting the caller to provide them explicitly.

---

## Antipatterns

### A. Safety rules enforced by LLM instruction, not by capability

The deployment agent is told `"Do NOT call printr_drain_deployment_wallet"` in its system
prompt, but the tool is still registered and visible. A confused model or an agent using a
different system prompt can call drain at any time. Safety-critical restrictions must be enforced
by not exposing the tool, not by hoping the instruction is followed.

**Fix:** Register `printr_drain_deployment_wallet` only on a separate "admin" MCP instance, not
in the deployment agent's toolset. The deployment agent should never have visibility of the drain
tool.

---

### B. Error suppression in financial code paths

Three places swallow errors with `.catch()` that logs but does not propagate:
- Auto-drain in `launch-token.ts`
- `clearActiveWalletId` mapErr in `drain-deployment-wallet.ts`
- `clearLastDeploymentWalletId` mapErr in `drain-deployment-wallet.ts`

State-clearing failures mean the next operation may act on stale wallet state. Financial code
should fail loudly or at minimum record the inconsistency in a durable way.

**Fix:** Surface state-clearing errors in the tool response rather than suppressing them. For
auto-drain, use the `drain_status` field (see Issue 1). For wallet ID cleanup, return a warning
field in the drain response if clearing fails so the consumer knows the state may be inconsistent.

---

### C. Implicit state machine without documented transitions

The deployment wallet lifecycle has four states: created, funded, launched, drained. These states
are spread across in-memory maps, persisted files, and the MCP process lifetime — with no single
place documenting the valid transitions or invariants. The implicit state machine makes the system
fragile across process restarts and difficult to test.

**Fix:** Document the state machine explicitly — either as a comment block in `fund-deployment-wallet.ts`
or as a separate `WALLET_LIFECYCLE.md`. Define valid transitions, which transitions are idempotent,
and what state survives a process restart. This is a prerequisite for writing reliable integration
tests.

---

### D. Consumer and provider validate independently at different layers

Both projects validate inputs (passwords, chain IDs, image sizes) independently, using their own
Zod schemas and logic. Changes to provider validation don't automatically tighten consumer
behavior, and vice versa. With no shared validation module, the two can silently diverge.

**Fix:** Extract shared validation constants and Zod schemas into `packages/sdk` (e.g., password
rules, chain namespace patterns, image size limits). Both the MCP server and the consumer import
from the same source, ensuring they stay in sync without coordination overhead.

---

## Summary

| # | Issue | Severity | Fund risk |
|---|-------|----------|-----------|
| 1 | Silent auto-drain failure | Critical | Yes — stuck funds |
| 2 | `spend_usd: 0` invalid | Critical | Deployment fails |
| 3 | No consumer-side wallet recovery | Critical | Yes — unrecoverable |
| 4 | Fee collection schema mismatch | High | Silent loss of fee claims |
| 5 | Asymmetric password validation | High | Weak keys accepted |
| 6 | EVM key miscategorised | High | Silent EVM failures |
| 7 | activeWalletId vs lastDeploymentWalletId | Medium | Confusion on recovery |
| 8 | Double image generation | Medium | Wrong avatar silently |
| 9 | Single-address multi-chain inference | Medium | Wrong creator address |
| A | Drain restriction by instruction only | Antipattern | Accidental drain |
| B | Error suppression in financial paths | Antipattern | Stale state |
| C | Undocumented state machine | Antipattern | Fragile recovery |
| D | Independent validation layers | Antipattern | Drift over time |
