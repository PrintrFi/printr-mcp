import { describe, expect, it } from "bun:test";
import type { PayloadEVM, PayloadSolana } from "@printr/sdk";
import { toEvmPayload, toSvmPayload } from "./claim-fees.js";

// ---------------------------------------------------------------------------
// toEvmPayload
// ---------------------------------------------------------------------------

describe("toEvmPayload", () => {
  it("builds the CAIP-10 `to` from chain id + txTo", () => {
    const payload: PayloadEVM = {
      txTo: "0xabc",
      calldata: "0xdeadbeef",
      txValue: "1000",
      gasLimit: "300000",
    };
    expect(toEvmPayload(payload, "eip155:8453")).toEqual({
      to: "eip155:8453:0xabc",
      calldata: "0xdeadbeef",
      value: "1000",
      gas_limit: 300000,
    });
  });

  it("defaults `value` to '0' when txValue is empty / missing", () => {
    const payload: PayloadEVM = {
      txTo: "0xabc",
      calldata: "0x",
      txValue: "",
      gasLimit: "100",
    };
    expect(toEvmPayload(payload, "eip155:1").value).toBe("0");
  });

  it("defaults `gas_limit` to 200000 when gasLimit is missing / unparseable", () => {
    const payload: PayloadEVM = {
      txTo: "0xabc",
      calldata: "0x",
      txValue: "0",
      gasLimit: "",
    };
    expect(toEvmPayload(payload, "eip155:1").gas_limit).toBe(200000);

    const nanPayload: PayloadEVM = {
      txTo: "0xabc",
      calldata: "0x",
      txValue: "0",
      gasLimit: "not-a-number",
    };
    expect(toEvmPayload(nanPayload, "eip155:1").gas_limit).toBe(200000);
  });

  it("parses numeric gasLimit through Number()", () => {
    const payload: PayloadEVM = {
      txTo: "0xabc",
      calldata: "0x",
      txValue: "0",
      gasLimit: "150000",
    };
    expect(toEvmPayload(payload, "eip155:1").gas_limit).toBe(150000);
  });
});

// ---------------------------------------------------------------------------
// toSvmPayload
// ---------------------------------------------------------------------------

describe("toSvmPayload", () => {
  it("flattens instruction program / account addresses out of the wrapper objects", () => {
    const payload: PayloadSolana = {
      ixs: [
        {
          programId: { address: "11111111111111111111111111111111" },
          accounts: [
            {
              pubkey: { address: "AcctA" },
              isSigner: true,
              isWritable: false,
            },
            {
              pubkey: { address: "AcctB" },
              isSigner: false,
              isWritable: true,
            },
          ],
          dataBase64: "AQID",
        },
      ],
      lookupTable: undefined,
      telecoinMintAddress: { address: "Mint123" },
    };

    expect(toSvmPayload(payload)).toEqual({
      ixs: [
        {
          program_id: "11111111111111111111111111111111",
          accounts: [
            { pubkey: "AcctA", is_signer: true, is_writable: false },
            { pubkey: "AcctB", is_signer: false, is_writable: true },
          ],
          data: "AQID",
        },
      ],
      lookup_table: undefined,
      mint_address: "Mint123",
    });
  });

  it("coerces a missing programId / pubkey / mint address to empty string (downstream signer expects a string)", () => {
    const payload: PayloadSolana = {
      ixs: [
        {
          programId: undefined,
          accounts: [{ pubkey: undefined, isSigner: false, isWritable: false }],
          dataBase64: "",
        },
      ],
      lookupTable: undefined,
      telecoinMintAddress: undefined,
    };

    const out = toSvmPayload(payload);
    expect(out.ixs[0]?.program_id).toBe("");
    expect(out.ixs[0]?.accounts[0]?.pubkey).toBe("");
    expect(out.mint_address).toBe("");
  });

  it("preserves a populated lookup_table reference", () => {
    const lookupTable = { address: "lookup-table-1", accounts: ["a", "b"] };
    const payload: PayloadSolana = {
      ixs: [],
      lookupTable,
      telecoinMintAddress: undefined,
    };
    expect(toSvmPayload(payload).lookup_table).toBe(lookupTable);
  });
});
