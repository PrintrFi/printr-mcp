import { err, ok, type Result } from "neverthrow";

export type ChainType = "evm" | "svm";

export type ParsedCaip2 = {
  readonly namespace: string;
  readonly chainRef: string;
};

export type ParsedCaip10 = ParsedCaip2 & {
  readonly address: string;
};

export type SupportedNamespace = "eip155" | "solana";

/**
 * Split a CAIP-2 chain id (`namespace:chainRef`).
 * Returns `null` if the input is not exactly two non-empty colon-separated parts.
 */
export function parseCaip2(caip2: string): ParsedCaip2 | null {
  const parts = caip2.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }
  return { namespace: parts[0], chainRef: parts[1] };
}

/**
 * Split a CAIP-10 account id (`namespace:chainRef:address`).
 * The address may contain colons and is preserved verbatim. Returns `null` on malformed input.
 */
export function parseCaip10(caip10: string): ParsedCaip10 | null {
  const parts = caip10.split(":");
  const namespace = parts[0];
  const chainRef = parts[1];
  if (!namespace || !chainRef || parts.length < 3) {
    return null;
  }
  return { namespace, chainRef, address: parts.slice(2).join(":") };
}

/** Format a CAIP-2 chain id from its parts. */
export const toCaip2 = ({ namespace, chainRef }: ParsedCaip2): string => `${namespace}:${chainRef}`;

/** Type guard for namespaces the SDK supports (`eip155`, `solana`). */
export const isSupportedNamespace = (ns: string): ns is SupportedNamespace =>
  ns === "eip155" || ns === "solana";

/** Map a CAIP namespace to its chain family (`solana` → `svm`, everything else → `evm`). */
export const namespaceToChainType = (namespace: string): ChainType =>
  namespace === "solana" ? "svm" : "evm";

/** Shortcut for {@link namespaceToChainType} that reads from a full CAIP-2 string. */
export const chainTypeFromCaip2 = (caip2: string): ChainType =>
  caip2.startsWith("solana:") ? "svm" : "evm";

/** Solana mainnet CAIP-2 chain id, used to prefix a bare mint address into CAIP-10. */
export const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

/** Telecoin ID: bare hex, with or without `0x` prefix. */
export const TELECOIN_ID = /^(0x)?[a-f0-9]{8,}$/i;
/** EVM CAIP-10 account id, e.g. `eip155:8453:0x...`. */
export const EVM_CAIP10 = /^eip155:\d+:0x[a-f0-9]{40}$/i;
/** Solana CAIP-10 account id, e.g. `solana:5eykt...:<mint>`. */
export const SOLANA_CAIP10 = /^solana:[^:]+:[1-9A-HJ-NP-Za-km-z]{32,44}$/i;
/** Bare Solana address/mint in base58, with no CAIP prefix. */
export const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Normalize a user-typed token identifier — Telecoin hex ID, EVM CAIP-10, Solana
 * CAIP-10, or a bare Solana mint address — into the canonical form the Printr API
 * accepts. Telecoin hex is checked first so an all-hex ambiguous input stays a
 * Telecoin ID instead of being mis-normalized as something else.
 */
export function normalizeTokenId(raw: string): Result<string, string> {
  if (TELECOIN_ID.test(raw) || EVM_CAIP10.test(raw) || SOLANA_CAIP10.test(raw)) {
    return ok(raw);
  }
  if (SOLANA_ADDRESS.test(raw)) {
    return ok(`${SOLANA_MAINNET}:${raw}`);
  }
  return err("not a Telecoin ID, CAIP-10 address, or Solana mint");
}
