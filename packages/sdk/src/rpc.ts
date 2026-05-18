/** RPC fallback utilities for retrying network-level failures across a list of endpoints. */

/** A single URL or an ordered priority list. */
export type RpcInput = string | readonly string[];

const RETRYABLE_PATTERNS: readonly RegExp[] = [
  /fetch failed/i,
  /socket hang up/i,
  /ECONNRESET/,
  /ECONNREFUSED/,
  /ETIMEDOUT/,
  /ENETUNREACH/,
  /ENOTFOUND/,
  /EAI_AGAIN/,
  /rate.?limit/i,
  /too many requests/i,
  /\b429\b/,
  /\b50[0-9]\b/,
  /request timed out/i,
  /\btimeout\b/i,
  /network error/i,
  /service unavailable/i,
  /bad gateway/i,
  /gateway timeout/i,
];

/**
 * Decide whether an error is a network-level RPC failure worth retrying on a
 * different endpoint. On-chain errors (revert, insufficient funds, sim failure)
 * are NOT retryable — they will repeat against any honest RPC.
 */
export function isRetryableRpcError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = error.message;
  return RETRYABLE_PATTERNS.some((p) => p.test(msg));
}

/** Normalise {@link RpcInput} (string | array | undefined) to a readonly array. */
export function toRpcList(input?: RpcInput): readonly string[] {
  if (input === undefined) {
    return [];
  }
  return typeof input === "string" ? [input] : input;
}

/**
 * Run `operation` against each URL in order, returning the first success.
 * Non-retryable errors (see {@link isRetryableRpcError}) abort immediately;
 * retryable errors fall through to the next URL. Throws the last error if all
 * URLs fail, or a "no URLs" error if `urls` is empty.
 */
export async function withRpcFallback<T>(
  urls: readonly string[],
  operation: (rpc: string) => Promise<T>,
): Promise<T> {
  if (urls.length === 0) {
    throw new Error("withRpcFallback: no RPC URLs provided");
  }
  let lastError: unknown;
  for (const url of urls) {
    try {
      return await operation(url);
    } catch (error) {
      lastError = error;
      if (!isRetryableRpcError(error)) {
        throw error;
      }
    }
  }
  throw lastError;
}
