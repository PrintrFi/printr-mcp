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

try {
  const txResult = await signAndSubmitEvm(
    result.value.deployments[0].payload,
    process.env.EVM_WALLET_PRIVATE_KEY!,
    'https://mainnet.base.org',
  );
  console.log('Transaction hash:', txResult.tx_hash);
} catch (error) {
  console.error('Transaction failed:', error);
}
```

### Check token balances

```typescript
import { getEvmTokenBalance } from '@printr/sdk/balance';

const balance = await getEvmTokenBalance(
  'eip155:8453',
  '0xTokenAddress',
  '0xWalletAddress',
  'https://mainnet.base.org',
);

console.log(`Balance: ${balance.formatted} ${balance.symbol}`);
```

### Transfer tokens

```typescript
import { transferToken } from '@printr/sdk/transfer';

const transfer = await transferToken({
  chain: 'eip155:8453',
  tokenAddress: '0x...',
  to: '0xRecipientAddress',
  amount: '1.5',
  privateKey: process.env.EVM_WALLET_PRIVATE_KEY!,
  rpcUrl: 'https://mainnet.base.org',
});
```

## Exports

The SDK is organized into focused modules that can be imported individually:

```typescript
// Main exports
import { createPrintrClient, buildToken } from '@printr/sdk';

// Client utilities
import { createPrintrClient } from '@printr/sdk/client';

// Chain information
import { chains, getChainByCAIP } from '@printr/sdk/chains';

// EVM operations
import { signAndSubmitEvm, deriveEVMAddress } from '@printr/sdk/evm';

// Solana operations
import { signAndSubmitSvm, deriveSOLAddress } from '@printr/sdk/svm';

// Balance queries
import { getBalance } from '@printr/sdk/balance';

// Token transfers
import { transferToken } from '@printr/sdk/transfer';

// Encrypted keystore
import { createKeystore, saveKeystore, loadKeystore } from '@printr/sdk/keystore';

// Image generation
import { generateImage } from '@printr/sdk/image';

// Type schemas
import { BuildTokenInput, QuoteInput } from '@printr/sdk/schemas';

// CAIP utilities
import { parseCAIP, formatCAIP } from '@printr/sdk/caip';
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
import { createKeystore, saveKeystore, addWallet } from '@printr/sdk/keystore';

// Create encrypted keystore (stored at ~/.printr/wallets.json)
const keystore = createKeystore(password);

// Add wallets
const evmWallet = addWallet(keystore, {
  label: 'my-evm-wallet',
  chainType: 'evm',
  privateKey: '0x...',
  password,
});

const svmWallet = addWallet(keystore, {
  label: 'my-sol-wallet',
  chainType: 'svm',
  privateKey: 'base58-secret',
  password,
});

// Save to disk
saveKeystore(keystore);
```

## Supported Chains

### EVM Chains (via CAIP-2)
- Ethereum: `eip155:1`
- Base: `eip155:8453`
- Polygon: `eip155:137`
- Arbitrum: `eip155:42161`
- Optimism: `eip155:10`
- Avalanche: `eip155:43114`
- BNB Smart Chain: `eip155:56`

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
buildToken(input: BuildTokenInput, client: PrintrClient): Promise<Result<BuildTokenOutput>>
getToken(tokenId: string, client: PrintrClient): Promise<Result<TokenDetails>>
quoteToken(input: QuoteInput, client: PrintrClient): Promise<Result<QuoteOutput>>
```

### Transaction Signing

```typescript
signAndSubmitEvm(params: {
  chain: string;
  payload: object;
  privateKey: string;
  rpcUrl: string;
}): Promise<Result<{ tx_hash: string }>>

signAndSubmitSvm(params: {
  chain: string;
  payload: object;
  privateKey: string;
  rpcUrl?: string;
}): Promise<Result<{ tx_hash: string }>>
```

## Examples

### Generate a token image

```typescript
import { generateImage } from '@printr/sdk/image';

const result = await generateImage({
  prompt: 'A futuristic digital coin with purple glow',
  apiKey: process.env.OPENROUTER_API_KEY!,
});

if (result.ok) {
  console.log('Image URL:', result.value.url);
}
```

### Query chain information

```typescript
import { chains, getChainByCAIP } from '@printr/sdk/chains';

// List all supported chains
console.log(chains);

// Get specific chain info
const base = getChainByCAIP('eip155:8453');
console.log(base?.name); // "Base"
```

## Error Handling

All operations return `Result<T, E>` types from [neverthrow](https://github.com/supermacro/neverthrow):

```typescript
const result = await buildToken(input, client);

if (result.isOk()) {
  console.log('Success:', result.value);
} else {
  console.error('Error:', result.error);
}

// Or use match
result.match(
  (value) => console.log('Success:', value),
  (error) => console.error('Error:', error),
);
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
