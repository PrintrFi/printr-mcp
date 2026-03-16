import { describe, expect, it } from "bun:test";
import { ensureHex } from "./hex.js";

describe("ensureHex", () => {
  it("returns hex-prefixed values unchanged", () => {
    expect(ensureHex("0x1234abcd")).toBe("0x1234abcd");
    expect(ensureHex("0xDEADBEEF")).toBe("0xDEADBEEF");
    expect(ensureHex("0x")).toBe("0x");
  });

  it("decodes Base64 to hex", () => {
    // "hello" in hex is 68656c6c6f
    const base64Hello = Buffer.from("hello").toString("base64"); // "aGVsbG8="
    expect(ensureHex(base64Hello)).toBe("0x68656c6c6f");

    // Test with binary data (simulating calldata)
    const binaryData = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    const base64Binary = binaryData.toString("base64"); // "3q2+7w=="
    expect(ensureHex(base64Binary)).toBe("0xdeadbeef");
  });

  it("decodes real EVM calldata from Base64", () => {
    // Simulate actual calldata that might come from API (even-length hex)
    const calldata = Buffer.from(
      "e8abf37900000000000000000000000000000000000000000000000000000000000000020000",
      "hex",
    );
    const base64Calldata = calldata.toString("base64");
    expect(ensureHex(base64Calldata)).toBe(
      "0xe8abf37900000000000000000000000000000000000000000000000000000000000000020000",
    );
  });

  it("handles empty string", () => {
    expect(ensureHex("")).toBe("0x");
  });

  it("handles transaction hash format", () => {
    // A typical 32-byte hash encoded as Base64
    const hashBytes = Buffer.from(
      "021d0ffed863daec0fddab1e7cd2969218af9a41b9a82721882dc451c009eccc",
      "hex",
    );
    const base64Hash = hashBytes.toString("base64");
    expect(ensureHex(base64Hash)).toBe(
      "0x021d0ffed863daec0fddab1e7cd2969218af9a41b9a82721882dc451c009eccc",
    );
  });

  it("decodes longer calldata correctly", () => {
    // Real-world calldata example
    const realCalldata =
      "e8abf379000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020";
    const base64 = Buffer.from(realCalldata, "hex").toString("base64");
    expect(ensureHex(base64)).toBe(`0x${realCalldata}`);
  });
});
