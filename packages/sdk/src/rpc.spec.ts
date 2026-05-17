import { describe, expect, it } from "bun:test";
import { isRetryableRpcError, toRpcList, withRpcFallback } from "./rpc.js";

describe("isRetryableRpcError", () => {
  it.each([
    "fetch failed",
    "socket hang up",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND api.example.com",
    "429 Too Many Requests",
    "rate limit exceeded",
    "503 Service Unavailable",
    "502 Bad Gateway",
    "request timed out after 30s",
    "network error",
  ])("flags '%s' as retryable", (msg) => {
    expect(isRetryableRpcError(new Error(msg))).toBe(true);
  });

  it.each([
    "execution reverted: ERC20: insufficient balance",
    "invalid signature",
    "nonce too low",
    "transaction simulation failed",
    "insufficient funds for gas * price + value",
  ])("flags '%s' as non-retryable", (msg) => {
    expect(isRetryableRpcError(new Error(msg))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isRetryableRpcError("fetch failed")).toBe(false);
    expect(isRetryableRpcError(undefined)).toBe(false);
    expect(isRetryableRpcError({ message: "fetch failed" })).toBe(false);
  });
});

describe("toRpcList", () => {
  it("wraps a single string in an array", () => {
    expect(toRpcList("https://rpc.example.com")).toEqual(["https://rpc.example.com"]);
  });

  it("passes arrays through unchanged", () => {
    const arr = ["https://a", "https://b"] as const;
    expect(toRpcList(arr)).toEqual(arr);
  });

  it("returns an empty array for undefined", () => {
    expect(toRpcList()).toEqual([]);
    expect(toRpcList(undefined)).toEqual([]);
  });
});

describe("withRpcFallback", () => {
  it("returns the first success without trying remaining URLs", async () => {
    const tried: string[] = [];
    const result = await withRpcFallback(["a", "b", "c"], async (url) => {
      tried.push(url);
      return `ok:${url}`;
    });
    expect(result).toBe("ok:a");
    expect(tried).toEqual(["a"]);
  });

  it("falls through to the next URL on retryable errors", async () => {
    const tried: string[] = [];
    const result = await withRpcFallback(["a", "b", "c"], async (url) => {
      tried.push(url);
      if (url !== "c") {
        throw new Error("fetch failed");
      }
      return `ok:${url}`;
    });
    expect(result).toBe("ok:c");
    expect(tried).toEqual(["a", "b", "c"]);
  });

  it("aborts immediately on non-retryable errors", async () => {
    const tried: string[] = [];
    const promise = withRpcFallback(["a", "b"], async (url) => {
      tried.push(url);
      throw new Error("execution reverted");
    });
    await expect(promise).rejects.toThrow("execution reverted");
    expect(tried).toEqual(["a"]);
  });

  it("throws the last error if all URLs fail with retryable errors", async () => {
    let i = 0;
    const promise = withRpcFallback(["a", "b"], async () => {
      i += 1;
      throw new Error(`fetch failed ${i}`);
    });
    await expect(promise).rejects.toThrow("fetch failed 2");
  });

  it("throws when given an empty URL list", async () => {
    await expect(withRpcFallback([], async () => "x")).rejects.toThrow(
      "withRpcFallback: no RPC URLs provided",
    );
  });
});
