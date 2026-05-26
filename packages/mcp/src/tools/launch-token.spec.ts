import { describe, expect, it } from "bun:test";
import { type DrainOutcome, drainFields, isEvmPayload } from "./launch-token.js";

// ---------------------------------------------------------------------------
// isEvmPayload
// ---------------------------------------------------------------------------

describe("isEvmPayload", () => {
  it("returns true for an object with a calldata field", () => {
    expect(
      isEvmPayload({
        to: "eip155:8453:0xcontract",
        calldata: "0xdeadbeef",
        value: "0",
        gas_limit: 200000,
      }),
    ).toBe(true);
  });

  it("returns true even when calldata is empty (presence is the discriminator)", () => {
    expect(isEvmPayload({ calldata: "" })).toBe(true);
  });

  it("returns false for an SVM-shaped payload with ixs but no calldata", () => {
    expect(
      isEvmPayload({
        ixs: [{ program_id: "11111111111111111111111111111111", accounts: [], data: "" }],
        lookup_table: undefined,
        mint_address: "",
      }),
    ).toBe(false);
  });

  // Wrap each value in an outer array — bun:test's `it.each` spreads the entry
  // into the callback args; a bare `[]` entry would spread to zero args and the
  // runner would expect the callback's first param to be `done`.
  it.each([
    [null],
    [undefined],
    ["calldata"],
    [42],
    [[]],
    [true],
  ])("returns false for non-object payload %p", (value) => {
    expect(isEvmPayload(value)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// drainFields
// ---------------------------------------------------------------------------

describe("drainFields", () => {
  it("projects an ok outcome to status + wallet_id (no error field)", () => {
    const outcome: DrainOutcome = { status: "ok", walletId: "wallet-42" };
    const fields = drainFields(outcome);
    expect(fields).toEqual({ drain_status: "ok", drain_wallet_id: "wallet-42" });
    expect("drain_error" in fields).toBe(false);
  });

  it("projects a failed outcome to status + wallet_id + error", () => {
    const outcome: DrainOutcome = {
      status: "failed",
      walletId: "wallet-42",
      error: "insufficient gas",
    };
    expect(drainFields(outcome)).toEqual({
      drain_status: "failed",
      drain_wallet_id: "wallet-42",
      drain_error: "insufficient gas",
    });
  });

  it("projects a skipped outcome to status only (no wallet_id leak)", () => {
    const fields = drainFields({ status: "skipped" });
    expect(fields).toEqual({ drain_status: "skipped" });
    expect("drain_wallet_id" in fields).toBe(false);
    expect("drain_error" in fields).toBe(false);
  });
});
