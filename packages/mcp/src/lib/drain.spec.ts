import { describe, expect, it } from "bun:test";
import type { ChainMeta } from "@printr/sdk";
import { buildDrainResult, formatAmount } from "./drain.js";

const SOL_META: ChainMeta = {
  name: "Solana",
  symbol: "SOL",
  decimals: 9,
  type: "svm",
};

const BASE_META: ChainMeta = {
  name: "Base",
  symbol: "ETH",
  decimals: 18,
  type: "evm",
};

// ---------------------------------------------------------------------------
// formatAmount
// ---------------------------------------------------------------------------

describe("formatAmount", () => {
  it.each([
    [0n, 0, "0"],
    [0n, 18, "0"],
    [1_000_000_000n, 9, "1"],
    [1_500_000_000n, 9, "1.5"],
    [1_000_000_000_000_000_000n, 18, "1"],
    [500_000n, 6, "0.5"],
  ])("formatAmount(%p, %p) === %p", (atomic, decimals, expected) => {
    expect(formatAmount(atomic, decimals)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// buildDrainResult — output shape
// ---------------------------------------------------------------------------

describe("buildDrainResult", () => {
  it("formats the base output without a tx field when none is provided", () => {
    const out = buildDrainResult(
      1_500_000_000n,
      SOL_META,
      "SrcAddr",
      "DstAddr",
      890_880n,
      "wallet-1",
    );
    expect(out).toEqual({
      drained_amount: "1.5",
      drained_atomic: "1500000000",
      symbol: "SOL",
      from_address: "SrcAddr",
      to_address: "DstAddr",
      remaining_balance: "0.00089088",
      wallet_id: "wallet-1",
    });
    expect("tx_signature" in out).toBe(false);
    expect("tx_hash" in out).toBe(false);
  });

  it("emits `tx_signature` (and not `tx_hash`) for an SVM tx", () => {
    const out = buildDrainResult(1_000_000_000n, SOL_META, "SrcAddr", "DstAddr", 0n, "wallet-1", {
      type: "svm",
      signature: "5K3...",
    });
    expect(out.tx_signature).toBe("5K3...");
    expect("tx_hash" in out).toBe(false);
  });

  it("emits `tx_hash` (and not `tx_signature`) for an EVM tx", () => {
    const out = buildDrainResult(
      1_000_000_000_000_000_000n,
      BASE_META,
      "0xfrom",
      "0xto",
      0n,
      "wallet-2",
      { type: "evm", hash: "0xabc" },
    );
    expect(out.tx_hash).toBe("0xabc");
    expect("tx_signature" in out).toBe(false);
  });

  it("uses chain meta to format amounts + symbol", () => {
    const out = buildDrainResult(
      2_000_000_000_000_000_000n, // 2 ETH at 18 decimals
      BASE_META,
      "0xfrom",
      "0xto",
      0n,
      "wallet-2",
    );
    expect(out.drained_amount).toBe("2");
    expect(out.symbol).toBe("ETH");
  });
});
