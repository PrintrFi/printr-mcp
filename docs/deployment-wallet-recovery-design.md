# Deployment Wallet Recovery Design

Safe, recoverable deployment wallet lifecycle for printr-mcp and memeprintr.

**Core invariant:** every SOL/ETH that enters a deployment wallet must have a deterministic,
programmatic path back to treasury — independent of LLM behaviour, process uptime, or network
reliability.

---

## Problem Summary

The current system has two fund-loss exposure windows:

1. **Auto-drain is silent.** `printr_launch_token` drains after launch via `.catch()` and returns
   no drain outcome in the response. If drain fails, the consumer sees `status: "submitted"` and
   has no signal to act on.

2. **Wallet ID is orphaned.** `DeploymentResult` drops `walletId` before it reaches the
   orchestrator. The orchestrator has no drain step. If auto-drain fails, there is no
   programmatic recovery path — only hope that the LLM retains `wallet_id` in context and the
   operator reads the logs.

---

## Provider Changes (printr-mcp)

### 1. Surface drain outcome in `printr_launch_token` response

Add `drain_status` to the output schema:

```ts
// packages/mcp/src/tools/launch-token.ts

const outputSchema = z.object({
  // ... existing fields ...
  drain_status: z
    .enum(["ok", "failed", "skipped"])
    .optional()
    .describe(
      "ok: funds returned to treasury. " +
      "failed: drain attempted but failed — use wallet_id to recover manually. " +
      "skipped: no active deployment wallet was found (key supplied directly).",
    ),
  drain_error: z.string().optional().describe("Drain failure reason when drain_status is 'failed'"),
  drain_wallet_id: z
    .string()
    .optional()
    .describe("Keystore wallet ID that was drained. Present when drain_status is 'ok' or 'failed'."),
});
```

Update `autoDrainSvmWallet` (and the new EVM equivalent) to return a typed result rather than
swallowing errors:

```ts
type DrainOutcome =
  | { status: "ok"; walletId: string }
  | { status: "failed"; walletId: string; error: string }
  | { status: "skipped" };

async function autoDrainSvmWallet(...): Promise<DrainOutcome> { ... }
async function autoDrainEvmWallet(...): Promise<DrainOutcome> { ... }
```

Thread the outcome into the tool response:

```ts
const drainOutcome = await autoDrain(activeWallet, chainType, chain, rpc_url);

return {
  ...launchResult,
  drain_status: drainOutcome.status,
  ...(drainOutcome.status !== "skipped" && { drain_wallet_id: drainOutcome.walletId }),
  ...(drainOutcome.status === "failed" && { drain_error: drainOutcome.error }),
};
```

### 2. Add EVM auto-drain parity

Export `drainEvm` from `drain-deployment-wallet.ts` and add `autoDrainEvmWallet` in
`launch-token.ts` mirroring the SVM path. `autoDrain` dispatches by `chainType`:

```ts
async function autoDrain(
  activeWallet: Omit<ResolvedWallet, "walletId">,
  chainType: ChainType,
  chain: string,
  rpcUrl?: string,
): Promise<DrainOutcome> {
  if (chainType === "svm") return autoDrainSvmWallet(activeWallet, chain, rpcUrl);
  if (chainType === "evm") return autoDrainEvmWallet(activeWallet, chain, rpcUrl);
  return { status: "skipped" };
}
```

### 3. Keep auto-drain as a safety net, not the primary mechanism

Auto-drain inside the tool handles the common path. The consumer's programmatic drain step
(described below) handles failures. Both must exist — the tool drain catches cases where the
consumer never reaches its drain step; the consumer drain catches cases where the tool drain
fails.

---

## Consumer Changes (memeprintr)

### 1. Thread `walletId` and `drainStatus` through `DeploymentResult`

`toDeploymentResult` currently drops `walletId`. Fix it:

```ts
// src/services/launch/deployment.ts

const toDeploymentResult = (r: AgentOutput): DeploymentResult => ({
  success: r.success,
  ...(r.tokenId     !== undefined && { tokenId: r.tokenId }),
  ...(r.txHash      !== undefined && { txHash: r.txHash }),
  ...(r.tradeUrl    !== undefined && { tradeUrl: r.tradeUrl }),
  ...(r.walletId    !== undefined && { walletId: r.walletId }),    // ← add
  ...(r.drainStatus !== undefined && { drainStatus: r.drainStatus }), // ← add
  ...(r.error       !== undefined && { error: r.error }),
  ...(r.errorCode   !== undefined && { errorCode: r.errorCode }),
});
```

Add `walletId` and `drainStatus` to `DeploymentAgentOutputSchema` and `DeploymentResult`:

```ts
// src/mastra/workflows/deployment.ts
export const DeploymentAgentOutputSchema = z.object({
  // ... existing fields ...
  walletId: z.string().optional().describe("Keystore wallet ID — persist for recovery"),
  drainStatus: z.enum(["ok", "failed", "skipped"]).optional(),
});
```

### 2. Persist `walletId` in the database

The deployment record in DB should track wallet lifecycle state:

```ts
// schema addition (conceptual)
walletId:    text("wallet_id"),
drainStatus: text("drain_status"),   // 'funded' | 'drained' | 'drain_failed' | null
drainedAt:   timestamp("drained_at"),
```

`persistDeploymentResult` writes `walletId` and `drainStatus: "funded"` (or `"drained"` if
`drainStatus === "ok"` from the tool response).

### 3. Add a programmatic drain step in the orchestrator

After `executeDeployment`, drain deterministically — no LLM involved:

```ts
// src/services/launch/orchestrator.ts

return executeDeployment(deploymentInput)
  .andThen(async (deployment) => {
    // Drain regardless of success/failure — funds may be sitting in wallet either way
    if (deployment.walletId && deployment.drainStatus !== "ok") {
      await drainWallet(deployment.walletId, targetChain);
    }
    return deployment;
  })
  .andThen((deployment) => persistDeploymentResult(...))
  // ...
```

`drainWallet` calls the MCP drain tool programmatically (not via LLM):

```ts
// src/services/launch/drain.ts

export async function drainWallet(walletId: string, chain: string): Promise<void> {
  const toolsets = await mcpClient.listToolsets();
  const drainTool = toolsets["printr"]?.["printr_drain_deployment_wallet"];
  if (!drainTool) {
    logger.error("Drain tool not available — wallet may have stuck funds", { walletId, chain });
    return;
  }
  try {
    await drainTool.execute({ wallet_id: walletId, chain, keep_minimum: "0" });
    await markWalletDrained(walletId);
  } catch (e) {
    logger.error("Programmatic drain failed", { walletId, chain, error: formatError(e) });
    await markWalletDrainFailed(walletId);
    // Do not rethrow — deployment result is already committed
  }
}
```

### 4. Add a startup recovery scan

On process start, query DB for any wallets in `drain_status = 'funded' | 'drain_failed'` and
drain them before accepting new deployments. This recovers from crashes, deploys where drain
silently failed, and process restarts mid-deployment:

```ts
// src/services/launch/recovery.ts

export async function recoverUndrainedWallets(): Promise<void> {
  const stuck = await db
    .select()
    .from(schema.deployments)
    .where(inArray(schema.deployments.drainStatus, ["funded", "drain_failed"]));

  if (stuck.length === 0) return;

  logger.warn("Found wallets pending drain recovery", { count: stuck.length });

  for (const record of stuck) {
    if (!record.walletId || !record.chainId) continue;
    logger.info("Recovering wallet", { walletId: record.walletId, chain: record.chainId });
    await drainWallet(record.walletId, record.chainId);
  }
}
```

Call `recoverUndrainedWallets()` at scheduler startup, before the first job runs.

### 5. Remove `printr_drain_deployment_wallet` from the deployment agent's toolset

The deployment agent should never see the drain tool. Register drain only in an admin/ops
toolset, separate from the deployment toolset. In Mastra, this means filtering the toolset passed
to the deployment agent's `generate` call:

```ts
// src/services/launch/deployment.ts

const allToolsets = await mcpClient.listToolsets();
const deploymentToolsets = excludeTools(allToolsets, ["printr_drain_deployment_wallet"]);

await deploymentAgent.generate(prompt, { toolsets: deploymentToolsets, ... });
```

This enforces Antipattern A's fix at the capability level, not the instruction level.

### 6. Fix `initial_buy` instruction in the agent system prompt

Replace:
```
- initial_buy: { spend_usd: 0 }
```
With:
```
- Omit initial_buy entirely if no buy is intended. Never pass spend_usd: 0.
```

---

## Drain Outcome Matrix

| Launch result | Tool drain | Orch drain step | Net outcome |
|---|---|---|---|
| Success | ok | skip (already drained) | ✅ Funds recovered |
| Success | failed | drain by walletId | ✅ Funds recovered |
| Success | skipped (no active wallet) | skip (walletId absent) | ✅ No deployment wallet used |
| Failure | ok | skip (already drained) | ✅ Funds recovered |
| Failure | failed | drain by walletId | ✅ Funds recovered |
| Failure | skipped | skip | ✅ No deployment wallet used |
| Crash before drain | — | startup recovery | ✅ Funds recovered on next start |

---

## Sequence: Happy Path

```
orchestrator
  → persistLaunchRecords()                   writes walletId=null, drainStatus=null
  → executeDeployment(input)
      agent: printr_fund_deployment_wallet   → walletId = "wallet_abc"
      agent: printr_launch_token             → auto-drain inside tool → drain_status="ok"
      returns { walletId, drainStatus:"ok", tokenId, txHash }
  → drainWallet(walletId, chain)             → drain_status already "ok", skip
  → persistDeploymentResult()               writes drainStatus="drained"
  → sendDeploymentNotifications()
```

## Sequence: Drain Failure Path

```
orchestrator
  → executeDeployment(input)
      agent: printr_fund_deployment_wallet   → walletId = "wallet_abc"
      agent: printr_launch_token             → auto-drain fails → drain_status="failed"
      returns { walletId, drainStatus:"failed", tokenId, txHash }
  → drainWallet("wallet_abc", chain)         → explicit MCP call, succeeds
  → persistDeploymentResult()               writes drainStatus="drained"
```

## Sequence: Crash Recovery

```
startup
  → recoverUndrainedWallets()
      DB query: drainStatus IN ('funded', 'drain_failed')
      → row: walletId="wallet_abc", chainId="solana:...", drainStatus="drain_failed"
      → drainWallet("wallet_abc", "solana:...")
      → markWalletDrained("wallet_abc")
  → scheduler starts
```

---

## Non-Goals

- This design does not add cross-chain bridging or multi-wallet batching.
- It does not change the agent's LLM model or deployment strategy.
- The fee collection schema mismatch (Issue 4 in the integration analysis) is a separate fix.
