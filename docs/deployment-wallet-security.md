# Deployment Wallet Security Specification

## Problem Statement

Deployment wallets are ephemeral wallets created to deploy tokens without exposing the treasury private key. Previously, these wallets were stored only in memory (`activeWallets` Map), meaning:

1. If the MCP process restarted, private keys were lost
2. Funded wallets became unrecoverable
3. SOL/ETH sent to deployment wallets was permanently lost

This document specifies the secure handling of deployment wallet credentials.

## Solution: Master Deployment Password + Persistent State

Use a single master password (from environment variable) to encrypt all deployment wallet private keys, combined with a persistent state file to track active wallets across restarts. This provides:

- **Persistence**: All deployment wallets saved to keystore before funding
- **Recoverability**: Any wallet can be unlocked with the master password after restart
- **Automatic Recovery**: State file tracks active/last deployment wallet for seamless drain after restart
- **Simplicity**: No per-wallet password management
- **Security**: Strong encryption with scrypt KDF + AES-256-GCM

## Configuration

### Required Environment Variable

```bash
PRINTR_DEPLOYMENT_PASSWORD="<strong-random-password>"
```

Generate a secure password:

```bash
openssl rand -base64 32
```

### Validation

The `printr_fund_deployment_wallet` tool MUST:

1. Require `PRINTR_DEPLOYMENT_PASSWORD` to be set (minimum 16 characters)
2. Fail with clear error if not configured
3. Never proceed to fund a wallet that cannot be persisted

## Implementation

### State File (`~/.printr/state.json`)

```typescript
type PersistentState = {
  version: 1;
  /** Active wallet IDs by chain type - reference to keystore wallet IDs */
  activeWalletIds: Partial<Record<"svm" | "evm", string>>;
  /** Treasury wallet IDs by chain type - reference to keystore wallet IDs */
  treasuryWalletIds: Partial<Record<"svm" | "evm", string>>;
  /** Last deployment wallet ID - for drain recovery after restart */
  lastDeploymentWalletId?: string;
};
```

### fund-deployment-wallet.ts

```typescript
import { env } from "~/lib/env.js";
import { setActiveWalletId, setLastDeploymentWalletId } from "~/lib/state.js";

function getDeploymentPassword(): Result<string, FundError> {
  const password = env.PRINTR_DEPLOYMENT_PASSWORD;
  if (!password) {
    return err({
      message:
        "PRINTR_DEPLOYMENT_PASSWORD environment variable is required. " +
        "This password encrypts deployment wallet private keys for recovery. " +
        "Generate one with: openssl rand -base64 32",
    });
  }
  if (password.length < 16) {
    return err({
      message:
        "PRINTR_DEPLOYMENT_PASSWORD must be at least 16 characters. " +
        "Use a strong random password: openssl rand -base64 32",
    });
  }
  return ok(password);
}

// After successful fund transfer:
activeWallets.set(type, { privateKey: wallet.privateKey, address: wallet.address });
setActiveWalletId(type, wallet.wallet_id);
setLastDeploymentWalletId(wallet.wallet_id);
```

### drain-deployment-wallet.ts

```typescript
function resolveWallet(type: ChainType, walletId?: string): Result<ResolvedWallet, DrainError> {
  // Priority 1: Explicit wallet_id parameter
  if (walletId) {
    return decryptFromKeystore(walletId);
  }

  // Priority 2: In-memory active wallet (current session)
  const memoryWallet = activeWallets.get(type);
  if (memoryWallet) {
    return ok(memoryWallet);
  }

  // Priority 3: Persisted active wallet ID (after restart recovery)
  const persistedActiveId = getActiveWalletId(type);
  if (persistedActiveId) {
    return decryptFromKeystore(persistedActiveId);
  }

  // Priority 4: Last deployment wallet ID (fallback recovery)
  const lastDeploymentId = getLastDeploymentWalletId();
  if (lastDeploymentId) {
    return decryptFromKeystore(lastDeploymentId);
  }

  return err({ message: "No active deployment wallet found" });
}
```

### Environment Schema (env.ts)

```typescript
const schema = z.object({
  // ... existing fields
  /** Master password for encrypting deployment wallet private keys */
  PRINTR_DEPLOYMENT_PASSWORD: z.string().optional(),
});
```

## Wallet Lifecycle

### 1. Creation (fund_deployment_wallet)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Validate PRINTR_DEPLOYMENT_PASSWORD is set (min 16 chars)│
│ 2. Validate keystore directory is writable                  │
│ 3. Generate new keypair                                     │
│ 4. Encrypt private key with master password                 │
│ 5. Save to keystore (~/.printr/wallets.json)               │
│ 6. Transfer funds from treasury                             │
│ 7. Set as active wallet for signing (in-memory)             │
│ 8. Persist wallet ID to state file                          │
└─────────────────────────────────────────────────────────────┘
```

**Critical**: Steps 1-5 MUST complete before step 6. If persistence fails, no funds are transferred.

### 2. Usage (launch_token, sign_and_submit_*)

The wallet is set as the "active wallet" in memory for immediate use. If the process restarts before the operation completes, the wallet can be recovered and unlocked using:
- The state file (tracks active wallet ID)
- The master password (decrypts the private key)

### 3. Recovery (drain_deployment_wallet)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Check for explicit wallet_id parameter                   │
│ 2. OR check in-memory activeWallets                         │
│ 3. OR load from persisted activeWalletIds in state file     │
│ 4. OR load from lastDeploymentWalletId in state file        │
│ 5. Decrypt private key using master password                │
│ 6. Transfer remaining balance to treasury                   │
│ 7. Clear state (activeWallets, state file entries)          │
└─────────────────────────────────────────────────────────────┘
```

### 4. Cleanup

Deployment wallets can be removed from the keystore after draining:

- `printr_wallet_remove` - remove single wallet
- `printr_wallet_bulk_remove` - remove multiple wallets

## Security Considerations

### Password Storage

- Store `PRINTR_DEPLOYMENT_PASSWORD` securely (not in version control)
- Use environment variables, secrets manager, or encrypted config
- Rotate periodically if desired (will require re-encrypting existing wallets)

### Keystore Protection

- Default location: `~/.printr/wallets.json`
- Contains encrypted private keys (safe if password is strong)
- Back up regularly
- Set appropriate file permissions: `chmod 600 ~/.printr/wallets.json`

### State File Protection

- Default location: `~/.printr/state.json`
- Contains only wallet IDs (not keys) - safe to expose
- Used for recovery, not security

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Keystore file stolen | Keys encrypted with strong password |
| State file stolen | Only contains IDs, not keys |
| Password compromised | Rotate password, re-encrypt wallets |
| Process crash | Wallet persisted before funding; state file enables recovery |
| Memory dump | Active wallet in memory is transient |

## Migration

For existing deployments with wallets created without passwords:

1. Those funds are unrecoverable (keys were never persisted)
2. Set `PRINTR_DEPLOYMENT_PASSWORD` for all future deployments
3. Consider adding monitoring for wallet balances

## Input/Output Schema Changes

### fund_deployment_wallet

**Input** (simplified - no more label/password):
```typescript
const inputSchema = z.object({
  chain: z.string(),
  amount: z.string(),
});
```

**Output** (no more generated_password):
```typescript
const outputSchema = z.object({
  address: z.string(),
  chain: z.string(),
  chain_name: z.string(),
  amount_funded: z.string(),
  amount_atomic: z.string(),
  symbol: z.string(),
  tx_signature: z.string().optional(),
  tx_hash: z.string().optional(),
  wallet_id: z.string(), // Always present - wallet is always persisted
});
```

### drain_deployment_wallet

**Input** (added wallet_id for explicit recovery):
```typescript
const inputSchema = z.object({
  chain: z.string(),
  keep_minimum: z.string().optional().default("0"),
  wallet_id: z.string().optional(), // NEW: for explicit wallet recovery
});
```

**Output** (added wallet_id):
```typescript
const outputSchema = z.object({
  drained_amount: z.string(),
  drained_atomic: z.string(),
  symbol: z.string(),
  from_address: z.string(),
  to_address: z.string(),
  tx_signature: z.string().optional(),
  tx_hash: z.string().optional(),
  remaining_balance: z.string(),
  wallet_id: z.string(), // NEW: confirms which wallet was drained
});
```

## Files Changed

- `src/lib/env.ts` - Added `PRINTR_DEPLOYMENT_PASSWORD` to env schema
- `src/lib/state.ts` - NEW: Persistent state management
- `src/tools/fund-deployment-wallet.ts` - Uses master password, persists state
- `src/tools/fund-deployment-wallet.spec.ts` - Updated tests
- `src/tools/drain-deployment-wallet.ts` - Recovery from persisted state

## Checklist

- [x] Add `PRINTR_DEPLOYMENT_PASSWORD` to env schema
- [x] Create `src/lib/state.ts` for persistent state management
- [x] Update `fund-deployment-wallet.ts` to require master password
- [x] Update `fund-deployment-wallet.ts` to persist state after funding
- [x] Remove `label`, `password`, `generated_password` from fund-deployment-wallet
- [x] Update `drain-deployment-wallet.ts` to support recovery via:
  - [x] Explicit `wallet_id` parameter
  - [x] In-memory active wallet
  - [x] Persisted active wallet ID
  - [x] Last deployment wallet ID
- [x] Clear state after successful drain
- [x] Update tests
- [ ] Update README with new environment variable
