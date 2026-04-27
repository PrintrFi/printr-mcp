# @printr/sdk

TypeScript SDK for [Printr](https://printr.money) — create and manage tokens across EVM chains and Solana.

## Features

- 🌐 **Multi-chain support** — Deploy tokens on Base, Ethereum, Solana, and more
- 🔐 **Secure wallet management** — Encrypted keystore with AES-256-GCM
- 💰 **Balance & transfers** — Query balances and transfer tokens across chains
- 🖼️ **Image generation** — AI-powered token avatar creation
- 📦 **Framework-agnostic** — Works with Node.js, Bun, and browsers
- 🔄 **Type-safe** — Full TypeScript support with Zod schemas

## Installation

```bash
npm install @printr/sdk
# or
bun add @printr/sdk
# or
yarn add @printr/sdk
```

## Quick Start

### Create a token

```typescript
import { createPrintrClient, buildToken } from '@printr/sdk';

const client = createPrintrClient({
  apiKey: process.env.PRINTR_API_KEY!,
  baseUrl: process.env.PRINTR_API_BASE_URL ?? 'https://api-preview.printr.money',
});

const result = await buildToken(
  {
    creator_accounts: ['eip155:8453:0xYourAddress'],
    name: 'My Token',
    symbol: 'TKN',
    description: 'A cool token',
    chains: ['eip155:8453'], // Base
    initial_buy: { spend_usd: 10 },
  },
  client,
);

if (result.isOk()) {
  console.log('Token created:', result.value.token_id);
}
```

### Sign and submit transactions

```typescript
import { signAndSubmitEvm } from '@printr/sdk/evm';
import { ResultAsync } from 'neverthrow';

// Chain buildToken directly into signing
buildToken(input, client)
  .andThen(({ token_id, payload }) =>
    ResultAsync.fromPromise(
      signAndSubmitEvm(payload, process.env.EVM_WALLET_PRIVATE_KEY!),
      (e) => ({ message: e instanceof Error ? e.message : String(e) }),
    ).map((tx) => ({ token_id, tx }))
  )
  .match(
    ({ token_id, tx }) => console.log('Token:', token_id, 'TX:', tx.tx_hash),
    (err) => console.error('Failed:', err.message),
  );
```

### Check token balances

```typescript
import { checkEvmBalance } from '@printr/sdk/balance';

// checkEvmBalance returns ResultAsync — chain directly or await
const balance = await checkEvmBalance(
  '0xYourWalletAddress',
  8453, // Base chain ID
  21000, // gas limit estimate
);

balance.match(
  ({ balanceFormatted, symbol, sufficient }) =>
    console.log(`Balance: ${balanceFormatted} ${symbol} (sufficient: ${sufficient})`),
  (err) => console.error('Balance fetch failed:', err), // 'no_rpc' | 'fetch_failed'
);
```

### Transfer tokens

```typescript
import { executeTransfer } from '@printr/sdk/transfer';
import { getChainMeta } from '@printr/sdk/chains';

const meta = getChainMeta('eip155:8453')!;
const result = await executeTransfer(
  'eip155',    // namespace
  '8453',      // chainRef (Base)
  '0xRecipientAddress',
  '1.5',       // amount in native token units
  process.env.EVM_WALLET_PRIVATE_KEY!,
  meta,
);

if (result.isOk()) {
  console.log('tx_hash' in result.value ? result.value.tx_hash : result.value.signature);
}
```

## Exports

The SDK is organized into focused modules that can be imported individually:

```typescript
// Main exports
import { createPrintrClient, buildToken } from '@printr/sdk';

// Client utilities
import { createPrintrClient } from '@printr/sdk/client';

// Chain information
import { CHAIN_META, getChainMeta } from '@printr/sdk/chains';

// EVM operations
import { signAndSubmitEvm, normalisePrivateKey } from '@printr/sdk/evm';

// Solana operations
import { signAndSubmitSvm, getSvmRpcUrl } from '@printr/sdk/svm';

// Balance queries
import { checkEvmBalance, checkSvmBalance, getEvmNativeBalance } from '@printr/sdk/balance';

// Token transfers
import { executeTransfer, transferEvm, transferSvm } from '@printr/sdk/transfer';

// Wallet keystore
import { addWallet, decryptKey, encryptKey, listWallets } from '@printr/sdk/keystore';

// Image generation
import { generateImageFromPrompt, generateTokenImage } from '@printr/sdk/image';

// CAIP utilities — both return null for invalid input (never throw)
import { parseCaip2, parseCaip10, chainTypeFromCaip2 } from '@printr/sdk/caip';

// Staking API
import {
  listStakePositionsWithRewards,
  claimStakingRewards,
  parseStakingCaip10,
  formatStakingCaip10,
  StakingLockPeriod,
} from '@printr/sdk';
```

## Configuration

### Environment Variables

| Variable                      | Description                                                |
| ----------------------------- | ---------------------------------------------------------- |
| `PRINTR_API_KEY`              | Optional API key. Defaults to public AI integration key   |
| `PRINTR_API_BASE_URL`         | API base URL (default: `https://api-preview.printr.money`)|
| `OPENROUTER_API_KEY`          | For AI image generation                                    |
| `OPENROUTER_IMAGE_MODEL`      | Image model override (default: `google/gemini-2.5-flash-image`) |
| `EVM_WALLET_PRIVATE_KEY`      | Default EVM private key for signing                        |
| `SVM_WALLET_PRIVATE_KEY`      | Default Solana keypair secret for signing                  |
| `PRINTR_DEPLOYMENT_PASSWORD`  | Master password for encrypted keystore (min 16 chars)      |

### Keystore Security

The SDK uses AES-256-GCM encryption with scrypt key derivation to securely store wallet private keys:

```typescript
import { encryptKey, addWallet, listWallets, type WalletEntry } from '@printr/sdk/keystore';
import { randomUUID } from 'node:crypto';

// Encrypt a private key and build a WalletEntry
const encrypted = encryptKey('0x...', password);
const entry: WalletEntry = {
  id: randomUUID(),
  label: 'my-evm-wallet',
  chain: 'eip155:8453',
  address: '0xYourAddress',
  ...encrypted,
  createdAt: Date.now(),
};

// Persist to ~/.printr/wallets.json
addWallet(entry);

// List all stored wallets (keys are encrypted — address is safe to read)
const wallets = listWallets();
console.log(wallets.map((w) => `${w.label}: ${w.address}`));
```

## Supported Chains

### EVM Chains (via CAIP-2)
- Ethereum: `eip155:1`
- BNB Smart Chain: `eip155:56`
- Unichain: `eip155:130`
- Monad: `eip155:143`
- HyperEVM: `eip155:999`
- MegaETH: `eip155:4326`
- Mantle: `eip155:5000`
- Base: `eip155:8453`
- Plasma: `eip155:9745`
- Arbitrum: `eip155:42161`
- Avalanche: `eip155:43114`

### Solana
- Mainnet: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`

## API Reference

### Client

```typescript
createPrintrClient(options?: {
  apiKey?: string;
  baseUrl?: string;
}): PrintrClient
```

### Token Operations

```typescript
buildToken(input: BuildTokenInput, client: PrintrClient): ResultAsync<BuildTokenOutput, PrintrApiError>
getToken(tokenId: string, client: PrintrClient): ResultAsync<TokenDetails, PrintrApiError>
quoteToken(input: QuoteInput, client: PrintrClient): ResultAsync<QuoteOutput, PrintrApiError>
```

### Transaction Signing

```typescript
// Low-level: throws on error — wrap in ResultAsync.fromPromise or try/catch
signAndSubmitEvm(payload: EvmPayload, privateKey: string, rpcUrl?: string): Promise<EvmSubmitResult>
signAndSubmitSvm(payload: SvmPayload, privateKey: string, rpcUrl?: string): Promise<SvmSubmitResult>

// High-level transfer (Result-safe):
executeTransfer(namespace, chainRef, toAddress, amount, privateKey, meta): ResultAsync<TransferResult, TransferError>
```

## Examples

### Generate a token image

```typescript
import { generateImageFromPrompt } from '@printr/sdk/image';

const result = await generateImageFromPrompt(
  'A futuristic digital coin with purple glow',
  { openrouterApiKey: process.env.OPENROUTER_API_KEY! },
);

if (result.isOk()) {
  // result.value is a raw base64 string (no data-URI prefix)
  console.log('Image base64 length:', result.value.length);
}
```

### Query chain information

```typescript
import { CHAIN_META, getChainMeta } from '@printr/sdk/chains';

// List all supported chains
console.log(CHAIN_META);

// Get specific chain info
const base = getChainMeta('eip155:8453');
console.log(base?.name); // "Base"
```

## Error Handling

Most operations return [`ResultAsync<T, E>`](https://github.com/supermacro/neverthrow) from neverthrow — a typed, chainable async result that never throws.

```typescript
// Preferred: .match() for expression-style dispatch
buildToken(input, client).match(
  (value) => console.log('Token ID:', value.token_id),
  (error) => console.error('Failed:', error.message),
);

// Chain operations without awaiting
buildToken(input, client)
  .andThen(({ token_id, payload }) =>
    ResultAsync.fromPromise(signAndSubmitEvm(payload, privateKey), (e) => e as Error)
      .map((tx) => ({ token_id, tx }))
  )
  .match(
    ({ token_id, tx }) => console.log(token_id, tx.tx_hash),
    (err) => console.error(err),
  );

// Await to get Result<T, E> for imperative control flow
const result = await buildToken(input, client);
if (result.isErr()) {
  console.error('Error:', result.error.message);
  return;
}
console.log('Token ID:', result.value.token_id);
```

## TypeScript

The SDK is written in TypeScript and exports all types:

```typescript
import type {
  BuildTokenInput,
  BuildTokenOutput,
  QuoteInput,
  QuoteOutput,
  TokenDetails,
  Chain,
  Keystore,
} from '@printr/sdk';
```

## Requirements

- Node.js 18+ or Bun 1.0+
- TypeScript 5.9+ (peer dependency)

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Test
bun test

# Type check
bun run typecheck
```

## License

Apache-2.0

## Links

- [Documentation](https://github.com/PrintrFi/printr-mcp)
- [npm](https://www.npmjs.com/package/@printr/sdk)
- [GitHub](https://github.com/PrintrFi/printr-mcp)
- [Printr](https://printr.money)
