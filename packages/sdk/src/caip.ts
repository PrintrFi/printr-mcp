export type ChainType = "evm" | "svm";

export type ParsedCaip2 = {
  readonly namespace: string;
  readonly chainRef: string;
};

export type ParsedCaip10 = ParsedCaip2 & {
  readonly address: string;
};

export type SupportedNamespace = "eip155" | "solana";

export function parseCaip2(caip2: string): ParsedCaip2 | null {
  const parts = caip2.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { namespace: parts[0], chainRef: parts[1] };
}

export function parseCaip10(caip10: string): ParsedCaip10 | null {
  const parts = caip10.split(":");
  const namespace = parts[0];
  const chainRef = parts[1];
  if (!namespace || !chainRef || parts.length < 3) return null;
  return { namespace, chainRef, address: parts.slice(2).join(":") };
}

export const toCaip2 = ({ namespace, chainRef }: ParsedCaip2): string => `${namespace}:${chainRef}`;

export const isSupportedNamespace = (ns: string): ns is SupportedNamespace =>
  ns === "eip155" || ns === "solana";

export const namespaceToChainType = (namespace: string): ChainType =>
  namespace === "solana" ? "svm" : "evm";

export const chainTypeFromCaip2 = (caip2: string): ChainType =>
  caip2.startsWith("solana:") ? "svm" : "evm";
