/** Minimal CAIP-2 chain metadata derived from printr/web/app/stores/chains/defs.ts */

import { parseCaip2 } from "./caip.js";
import { ALCHEMY_RPC_TEMPLATES, env } from "./env.js";

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
    defaultRpc: "https://monad-mainnet.drpc.org",
  },
  "eip155:999": {
    name: "HyperEVM",
    symbol: "HYPE",
    decimals: 18,
    defaultRpc: "https://rpc.hyperliquid.xyz/evm",
  },
  "eip155:5000": {
    name: "Mantle",
    symbol: "MNT",
    decimals: 18,
    defaultRpc: "https://rpc.mantle.xyz",
  },
  "eip155:4326": {
    name: "MegaETH",
    symbol: "ETH",
    decimals: 18,
    defaultRpc: "https://mainnet.megaeth.com/rpc",
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

/** Additional aliases for chain names (lowercase) */
const CHAIN_ALIASES: Record<string, string> = {
  eth: "eip155:1",
  bsc: "eip155:56",
  arb: "eip155:42161",
  avax: "eip155:43114",
  sol: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
};

/** Map of lowercase chain names to CAIP-2 IDs (derived from CHAIN_META + aliases) */
const CHAIN_NAME_TO_CAIP2: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(CHAIN_META).map(([caip2, meta]) => [meta.name.toLowerCase(), caip2]),
  ),
  ...CHAIN_ALIASES,
};

export function getChainMeta(caip2: string): ChainMeta | undefined {
  return CHAIN_META[caip2];
}

/** Construct a CAIP-2 ID from namespace and chain reference */
export function toCaip2(namespace: "eip155" | "solana", chainRef: string | number): string {
  return `${namespace}:${chainRef}`;
}

/**
 * Extract the CAIP-2 chain ID from a CAIP-10 address.
 * "eip155:8453:0xabc" → "eip155:8453"
 * "solana:5eykt...:pubkey" → "solana:5eykt..."
 */
export function caip10ToChainId(caip10: string): string {
  const parts = caip10.split(":");
  if (parts[0] === "eip155") {
    return `eip155:${parts[1]}`;
  }
  if (parts[0] === "solana") {
    return `solana:${parts[1]}`;
  }
  return parts.slice(0, 2).join(":");
}

/**
 * Look up user-configured RPC from RPC_URLS env var.
 * Checks CAIP-2 ID, chain name, and aliases (e.g. "eth", "sol", "arb").
 */
function getUserRpc(caip2: string): string | undefined {
  // Direct CAIP-2 lookup
  if (env.RPC_URLS[caip2]) {
    return env.RPC_URLS[caip2];
  }

  // Find all names/aliases that map to this caip2
  for (const [name, chainCaip2] of Object.entries(CHAIN_NAME_TO_CAIP2)) {
    if (chainCaip2 === caip2 && env.RPC_URLS[name]) {
      return env.RPC_URLS[name];
    }
  }

  return undefined;
}

/**
 * Get Alchemy RPC URL for a chain if ALCHEMY_API_KEY is set.
 */
function getAlchemyRpc(caip2: string): string | undefined {
  if (!env.ALCHEMY_API_KEY) {
    return undefined;
  }

  const meta = CHAIN_META[caip2];
  if (!meta) {
    return undefined;
  }

  const template = ALCHEMY_RPC_TEMPLATES[meta.name.toLowerCase()];
  if (!template) {
    return undefined;
  }

  return template.replace("{key}", env.ALCHEMY_API_KEY);
}

/**
 * Get the RPC URL for a chain, with the following precedence:
 * 1. Explicit `rpcOverride` parameter (per-call override)
 * 2. User-configured RPC from `RPC_URLS` env var (by chain name or CAIP-2)
 * 3. Alchemy RPC (if `ALCHEMY_API_KEY` is set and chain is supported)
 * 4. Default public RPC from `CHAIN_META`
 *
 * Returns undefined if no RPC is available.
 */
export function getRpcUrl(caip2: string, rpcOverride?: string): string | undefined {
  if (rpcOverride) {
    return rpcOverride;
  }
  const userConfigured = getUserRpc(caip2);
  if (userConfigured) {
    return userConfigured;
  }
  const alchemyRpc = getAlchemyRpc(caip2);
  if (alchemyRpc) {
    return alchemyRpc;
  }
  return CHAIN_META[caip2]?.defaultRpc;
}

export type EvmConfigResult = { error: string } | { chainId: number; rpc: string };

/**
 * Resolve a CAIP-2 chain string to EVM connection params.
 * Returns an error discriminant if the chain is invalid or has no RPC configured.
 */
export function getEvmConfig(chain: string, rpcOverride?: string): EvmConfigResult {
  const parsed = parseCaip2(chain);
  if (!parsed) {
    return { error: `Invalid CAIP-2 chain format: ${chain}. Expected 'namespace:chainRef'.` };
  }

  if (parsed.namespace !== "eip155") {
    return { error: `Chain ${chain} is not an EVM chain (expected eip155 namespace).` };
  }

  const chainId = Number(parsed.chainRef);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    return { error: `Invalid EVM chain ID in ${chain}.` };
  }

  const rpc = getRpcUrl(chain, rpcOverride);
  if (!rpc) {
    return { error: `No RPC URL for chain ${chain}. Set RPC_URLS or ALCHEMY_API_KEY.` };
  }

  return { chainId, rpc };
}
