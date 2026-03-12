---
name: printr
description: Launch and manage cross-chain tokens via Printr MCP. Use when creating tokens, checking balances, managing wallets, or transferring funds on EVM chains (Base, Ethereum, Arbitrum, etc.) or Solana.
---

# Printr MCP

Create and manage cross-chain tokens on Printr.

## Chain Identifiers

Use CAIP-2 format for chains and CAIP-10 for addresses:

| Chain    | CAIP-2 ID                                  |
|----------|-------------------------------------------|
| Base     | `eip155:8453`                             |
| Ethereum | `eip155:1`                                |
| Arbitrum | `eip155:42161`                            |
| Solana   | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |

**CAIP-10 addresses:** `{caip2}:{address}`
- EVM: `eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f2bD61`
- Solana: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:7S3P4HxJpR...`

## Token Launch Workflow

### Quick Launch (Recommended)

Use `printr_launch_token` for one-step token creation:

```
1. printr_launch_token
   - name, symbol, description
   - chains: ["eip155:8453"]
   - creator_accounts: ["eip155:8453:0x..."]
   - initial_buy: { spend_usd: 10 } or { supply_percent: 1 }
   - image_path: "/path/to/image.png" (optional, auto-generated if OPENROUTER_API_KEY set)
   - private_key: "0x..." (optional, opens browser signer if omitted)
```

### Treasury-Protected Launch

For production deployments, use ephemeral deployment wallets:

```
1. printr_set_treasury_wallet    # Set funding source (once per session)
2. printr_fund_deployment_wallet # Create & fund ephemeral wallet
3. printr_launch_token           # Deploy token (uses active wallet)
4. printr_drain_deployment_wallet # Return unused funds to treasury
```

### Cost Estimation

Always check costs before launching:

```
printr_quote
  chains: ["eip155:8453"]
  initial_buy: { spend_usd: 50 }
```

Returns itemized costs: deployment fees, gas estimates, initial buy amount.

## Wallet Management

### Session Wallets
- `printr_wallet_new` - Generate and encrypt new wallet
- `printr_wallet_import` - Import existing private key
- `printr_wallet_unlock` - Decrypt and activate stored wallet
- `printr_wallet_list` - List saved wallets (keys never exposed)

### Treasury Flow
- `printr_set_treasury_wallet` - Set funding source wallet
- `printr_fund_deployment_wallet` - Create funded ephemeral wallet
- `printr_drain_deployment_wallet` - Return remaining funds

## Balance & Transfer

```
printr_get_balance
  account: "eip155:8453:0x..."

printr_get_token_balance
  token: "eip155:8453:0xTokenAddress..."
  wallet: "eip155:8453:0x..."

printr_transfer
  to: "eip155:8453:0x..."
  amount: "0.1"  # human-readable (ETH, SOL)
```

## Token Lookup

```
printr_get_token
  id: "0x..." (telecoin ID) or "eip155:8453:0x..." (CAIP-10)

printr_get_deployments
  id: "0x..."  # Returns per-chain deployment status
```

## Initial Buy Options

One of:
- `spend_usd: 50` - Spend fixed USD amount
- `spend_native: "100000000"` - Spend native tokens (atomic units)
- `supply_percent: 1.5` - Buy percentage of supply (0.01-69%)

## Image Handling

Priority:
1. `image` - Base64-encoded (max 500KB)
2. `image_path` - Local file path (auto-compressed)
3. Auto-generated if `OPENROUTER_API_KEY` is set

Generate manually: `printr_generate_image prompt: "cute robot mascot"`

## Supported Chains

Use `printr_supported_chains` to list all available networks with their CAIP-2 IDs, native tokens, and RPC availability.
