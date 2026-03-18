---
name: printr
description: Launches cross-chain tokens via Printr MCP tools. Use when creating memecoins, checking wallet balances, managing keystore wallets, or transferring native tokens on Base, Ethereum, Arbitrum, Solana, and other supported chains.
---

# Printr MCP

## Quick Launch

`printr_launch_token` creates and signs in one call:
- Omit `private_key` to open browser signer
- Omit `image`/`image_path` to auto-generate (requires OPENROUTER_API_KEY)

## Treasury-Protected Launch

For production, use ephemeral wallets to protect the treasury:

1. `printr_set_treasury_wallet` — unlock funding source (once per session)
2. `printr_fund_deployment_wallet` — create & fund ephemeral wallet (requires `PRINTR_DEPLOYMENT_PASSWORD`)
3. `printr_launch_token` — deploy (uses active wallet automatically)
4. `printr_drain_deployment_wallet` — return unused funds

**Recovery after restart**: If MCP restarts before draining, call `printr_drain_deployment_wallet` again — it recovers from persisted state using `PRINTR_DEPLOYMENT_PASSWORD`.

## Cost Estimation

ALWAYS call `printr_quote` before launching to show the user itemized costs.

## Initial Buy Options

Specify ONE of:
- `spend_usd` — fixed USD amount
- `spend_native` — native tokens in atomic units (wei/lamports)
- `supply_percent` — percentage of supply (0.01–69%)

## Wallet Tools

| Tool | Purpose |
|------|---------|
| `printr_wallet_new` | Generate encrypted wallet |
| `printr_wallet_import` | Import existing key |
| `printr_wallet_unlock` | Activate stored wallet |
| `printr_wallet_list` | List wallets (keys hidden) |
| `printr_wallet_remove` | Remove wallet from keystore |
| `printr_wallet_bulk_remove` | Remove multiple wallets |

## Utility Tools

| Tool | Purpose |
|------|---------|
| `printr_get_balance` | Native token balance |
| `printr_get_token_balance` | ERC-20/SPL token balance |
| `printr_transfer` | Send native tokens |
| `printr_get_token` | Token metadata by ID |
| `printr_get_deployments` | Per-chain deployment status |
| `printr_supported_chains` | List all chains with CAIP-2 IDs |
| `printr_generate_image` | Generate token avatar via OpenRouter |

## Fee Tools

| Tool | Purpose |
|------|---------|
| `printr_get_creator_fees` | Check claimable creator fees |
| `printr_claim_fees` | Claim accumulated fees to treasury |

## Chain Format

All tools use CAIP-2 chains and CAIP-10 addresses. Run `printr_supported_chains` for the full list.
