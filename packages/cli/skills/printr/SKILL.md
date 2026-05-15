---
name: printr
description: Launch cross-chain tokens via Printr MCP. Use to create memecoins, check wallet balances, manage keystore wallets, transfer native tokens on Base, Ethereum, Arbitrum, Solana, other supported chains.
---

# Printr MCP

## Quick Launch

`printr_launch_token` create + sign in one call:
- Omit `private_key` → browser signer open
- Omit `image`/`image_path` → auto-gen (need OPENROUTER_API_KEY)

## Two-Step Launch

Agent need inspect/relay tx before sign, use split flow:

1. `printr_create_token` — return unsigned tx payload + token metadata
2. `printr_sign_and_submit_evm` or `printr_sign_and_submit_svm` — sign+submit payload (or pass `private_key` for autonomous mode)
3. `printr_open_web_signer` — open browser session (MetaMask / Phantom) when no key

## Treasury-Protected Launch

Production: use ephemeral wallets, protect treasury:

1. `printr_set_treasury_wallet` — unlock fund source (once/session)
2. `printr_fund_deployment_wallet` — create+fund ephemeral wallet (need `PRINTR_DEPLOYMENT_PASSWORD`)
3. `printr_launch_token` — deploy (use active wallet auto)
4. `printr_drain_deployment_wallet` — return unused funds

**Recovery after restart**: MCP restart before drain → call `printr_drain_deployment_wallet` again — recover from persisted state via `PRINTR_DEPLOYMENT_PASSWORD`.

## Cost Estimation

ALWAYS call `printr_quote` before launch, show user itemized costs.

## Initial Buy Options

Pick ONE:
- `spend_usd` — fixed USD
- `spend_native` — native tokens atomic units (wei/lamports)
- `supply_percent` — % of supply (0.01–69%)

## Wallet Tools

| Tool | Purpose |
|------|---------|
| `printr_wallet_new` | Gen encrypted wallet |
| `printr_wallet_import` | Import existing key |
| `printr_wallet_unlock` | Activate stored wallet |
| `printr_wallet_list` | List wallets (keys hidden) |
| `printr_wallet_remove` | Remove wallet from keystore |
| `printr_wallet_bulk_remove` | Remove many wallets |

## Utility Tools

| Tool | Purpose |
|------|---------|
| `printr_get_balance` | Native balance |
| `printr_get_token_balance` | ERC-20/SPL balance |
| `printr_transfer` | Send native |
| `printr_transfer_token` | Send ERC-20/SPL |
| `printr_get_token` | Token metadata by ID |
| `printr_get_deployments` | Per-chain deploy status |
| `printr_supported_chains` | List all chains w/ CAIP-2 IDs |
| `printr_generate_image` | Gen token avatar via OpenRouter |

## Fee Tools

| Tool | Purpose |
|------|---------|
| `printr_get_creator_fees` | Check claimable creator fees |
| `printr_claim_fees` | Claim fees to treasury |

## Staking Tools

| Tool | Purpose |
|------|---------|
| `printr_create_stake_position` | Open stake position on Printr token |
| `printr_get_staking_positions` | List stake positions (filter by token/owner) |
| `printr_claim_staking_rewards` | Claim rewards or withdraw unlocked principal |

## Signing Tools

| Tool | Purpose |
|------|---------|
| `printr_create_token` | Build unsigned token creation payload |
| `printr_sign_and_submit_evm` | Sign+submit EVM tx payload |
| `printr_sign_and_submit_svm` | Sign+submit Solana tx payload |
| `printr_open_web_signer` | Start browser sign session (MetaMask / Phantom) |

## Chain Format

All tools use CAIP-2 chains, CAIP-10 addresses. Run `printr_supported_chains` for full list.

## Setup & Troubleshooting

See [INSTALL.md](https://github.com/PrintrFi/printr-mcp/blob/main/INSTALL.md) for setup, env vars, RPC config.