/** Minimal CAIP-2 chain metadata derived from printr/web/app/stores/chains/defs.ts */

export type ChainMeta = {
  name: string;
  symbol: string;
  decimals: number;
  /** Default public RPC — may be absent for chains without a stable public endpoint */
  defaultRpc?: string;
};

export const CHAIN_META: Record<string, ChainMeta> = {
  "eip155:1": {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    defaultRpc: "https://cloudflare-eth.com",
  },
  "eip155:56": {
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
    defaultRpc: "https://bsc-dataseed.binance.org",
  },
  "eip155:130": {
    name: "Unichain",
    symbol: "ETH",
    decimals: 18,
    defaultRpc: "https://mainnet.unichain.org",
  },
  "eip155:143": {
    name: "Monad",
    symbol: "MON",
    decimals: 18,
    defaultRpc: "https://testnet-rpc.monad.xyz",
  },
  "eip155:999": {
    name: "HyperEVM",
    symbol: "HYPE",
    decimals: 18,
    defaultRpc: "https://rpc.hyperliquid-evm.xyz/evm",
  },
  "eip155:5000": {
    name: "Mantle",
    symbol: "MNT",
    decimals: 18,
    defaultRpc: "https://rpc.mantle.xyz",
  },
  "eip155:6342": {
    name: "MegaETH",
    symbol: "ETH",
    decimals: 18,
    defaultRpc: "https://carrot.megaeth.com/rpc",
  },
  "eip155:8453": {
    name: "Base",
    symbol: "ETH",
    decimals: 18,
    defaultRpc: "https://mainnet.base.org",
  },
  "eip155:9745": {
    name: "Plasma",
    symbol: "XPL",
    decimals: 18,
  },
  "eip155:42161": {
    name: "Arbitrum",
    symbol: "ETH",
    decimals: 18,
    defaultRpc: "https://arb1.arbitrum.io/rpc",
  },
  "eip155:43114": {
    name: "Avalanche",
    symbol: "AVAX",
    decimals: 18,
    defaultRpc: "https://api.avax.network/ext/bc/C/rpc",
  },
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": {
    name: "Solana",
    symbol: "SOL",
    decimals: 9,
    defaultRpc: "https://api.mainnet-beta.solana.com",
  },
};

export function getChainMeta(caip2: string): ChainMeta | undefined {
  return CHAIN_META[caip2];
}

/**
 * Extract the CAIP-2 chain ID from a CAIP-10 address.
 * "eip155:8453:0xabc" → "eip155:8453"
 * "solana:5eykt...:pubkey" → "solana:5eykt..."
 */
export function caip10ToChainId(caip10: string): string {
  const parts = caip10.split(":");
  if (parts[0] === "eip155") return `eip155:${parts[1]}`;
  if (parts[0] === "solana") return `solana:${parts[1]}`;
  return parts.slice(0, 2).join(":");
}
