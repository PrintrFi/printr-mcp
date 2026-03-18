import type { Hex } from "viem";

/**
 * Ensures a value is a 0x-prefixed hex string.
 * If the input is already hex-prefixed, returns as-is.
 * Otherwise, attempts to decode from Base64, falling back to treating as raw hex.
 */
export function ensureHex(value: string): Hex {
  if (value.startsWith("0x")) {
    return value as Hex;
  }

  // Try Base64 decode first
  try {
    const buf = Buffer.from(value, "base64");
    // Validate it decoded to something reasonable (not empty, looks like binary data)
    if (buf.length > 0) {
      return `0x${buf.toString("hex")}` as Hex;
    }
  } catch {
    // Not valid Base64, fall through
  }

  // Assume it's already hex without the prefix
  return `0x${value}` as Hex;
}
