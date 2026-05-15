---
name: printr
description: Launches cross-chain tokens via Printr MCP tools. Use when creating memecoins, checking wallet balances, managing keystore wallets, or transferring native tokens on Base, Ethereum, Arbitrum, Solana, and other supported chains.
---

# Printr MCP

## Quick Launch

`printr_launch_token` creates and signs in one call:
- Omit `private_key` to open browser signer
- Omit `image`/`image_path` to auto-generate (requires OPENROUTER_API_KEY)

## Two-Step Launch

When the agent needs to inspect or relay the tx before signing, use the split flow:

1. `printr_create_token` — returns an unsigned tx payload + token metadata
2. `printr_sign_and_submit_evm` or `printr_sign_and_submit_svm` — sign and submit the payload (or pass `private_key` for autonomous mode)
3. `printr_open_web_signer` — open a browser session (MetaMask / Phantom) when no key is available

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
| `printr_transfer_token` | Send ERC-20/SPL tokens |
| `printr_get_token` | Token metadata by ID |
| `printr_get_deployments` | Per-chain deployment status |
| `printr_supported_chains` | List all chains with CAIP-2 IDs |
| `printr_generate_image` | Generate token avatar via OpenRouter |

## Fee Tools

| Tool | Purpose |
|------|---------|
| `printr_get_creator_fees` | Check claimable creator fees |
| `printr_claim_fees` | Claim accumulated fees to treasury |

## Staking Tools

| Tool | Purpose |
|------|---------|
| `printr_create_stake_position` | Open a stake position on a Printr token |
| `printr_get_staking_positions` | List stake positions (filter by token or owner) |
| `printr_claim_staking_rewards` | Claim rewards or withdraw unlocked principal |

## Signing Tools

| Tool | Purpose |
|------|---------|
| `printr_create_token` | Build an unsigned token creation payload |
| `printr_sign_and_submit_evm` | Sign and submit an EVM tx payload |
| `printr_sign_and_submit_svm` | Sign and submit a Solana tx payload |
| `printr_open_web_signer` | Start a browser signing session (MetaMask / Phantom) |

## Chain Format

All tools use CAIP-2 chains and CAIP-10 addresses. Run `printr_supported_chains` for the full list.

## Setup & Troubleshooting

See [INSTALL.md](https://github.com/PrintrFi/printr-mcp/blob/main/INSTALL.md) for detailed setup instructions, environment variables, and RPC configuration.
