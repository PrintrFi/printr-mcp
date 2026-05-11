import { afterEach, describe, expect, spyOn, test } from "bun:test";
import * as sdk from "@printr/sdk";
import { errAsync, okAsync } from "neverthrow";
import { createMockServer } from "../lib/test-helpers.js";
import { registerTransferTokenTool } from "./transfer-token.js";

describe("printr_transfer_token", () => {
  const setup = () => {
    const server = createMockServer();
    registerTransferTokenTool(server as any);
    return server.getRegisteredTool()!;
  };

  test.each([
    {
      input: { to: "invalid", token: "eip155:8453:0xabc", amount: "1" },
      error: "Invalid CAIP-10",
    },
    {
      input: { to: "eip155:999999:0x1234", token: "eip155:999999:0xabc", amount: "1" },
      error: "Unsupported",
    },
    {
      input: { to: "cosmos:hub:addr", token: "cosmos:hub:tokenAddr", amount: "1" },
      error: "Unsupported",
    },
    {
      input: {
        to: "eip155:8453:0x1234",
        token: "eip155:8453:0xabc",
        amount: "1",
      },
      error: "No private key",
    },
    {
      input: {
        to: "eip155:8453:0x1234",
        token: "eip155:42161:0xabc",
        amount: "1",
        private_key: "0x1111111111111111111111111111111111111111111111111111111111111111",
      },
      error: "chain mismatch",
    },
    {
      input: {
        to: "eip155:8453:0x1234",
        token: "not-caip10",
        amount: "1",
        private_key: "0x1111111111111111111111111111111111111111111111111111111111111111",
      },
      error: "Invalid CAIP-10 token",
    },
  ])("rejects invalid input: $error", async ({ input, error }) => {
    const result = await setup().handler(input);
    expect((result as any)?.isError).toBe(true);
    expect((result as any)?.content?.[0]?.text).toContain(error);
  });

  describe("happy path", () => {
    afterEach(() => {
      (sdk.executeTokenTransfer as any).mockRestore?.();
    });

    test("dispatches an EVM transfer and returns tx_hash with the input echoed back", async () => {
      const spy = spyOn(sdk, "executeTokenTransfer").mockReturnValue(
        okAsync({
          type: "evm",
          tx_hash: "0xMOCK_TX_HASH",
          amount_atomic: "1500000",
        }) as any,
      );

      const input = {
        to: "eip155:8453:0x1234567890123456789012345678901234567890",
        token: "eip155:8453:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        amount: "1.5",
        private_key: "0x1111111111111111111111111111111111111111111111111111111111111111",
      };
      const result = (await setup().handler(input)) as any;

      expect(result?.isError).toBeUndefined();
      expect(result?.structuredContent).toEqual({
        to: input.to,
        chain: "eip155:8453",
        chain_name: "Base",
        token: input.token,
        amount: "1.5",
        amount_atomic: "1500000",
        tx_hash: "0xMOCK_TX_HASH",
      });
      expect(result?.structuredContent?.signature).toBeUndefined();

      expect(spy).toHaveBeenCalledTimes(1);
      const args = spy.mock.calls[0]!;
      expect(args[0]).toBe("eip155");
      expect(args[1]).toBe("8453");
      expect(args[2]).toBe("0x1234567890123456789012345678901234567890");
      expect(args[3]).toBe(input.token);
      expect(args[4]).toBe("1.5");
      expect(args[5]).toBe(input.private_key);
    });

    test("dispatches an SVM transfer and returns the signature with the input echoed back", async () => {
      const spy = spyOn(sdk, "executeTokenTransfer").mockReturnValue(
        okAsync({
          type: "svm",
          signature: "MOCK_SIGNATURE",
          amount_atomic: "1500000000",
        }) as any,
      );

      const solChain = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
      const input = {
        to: `${solChain}:Ez4hEGekBmzgYYgDuwXW68LNzRUdHSTU1A1CLvLyumjR`,
        token: `${solChain}:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`,
        amount: "1.5",
        private_key: "BASE58_KEYPAIR_PLACEHOLDER",
      };
      const result = (await setup().handler(input)) as any;

      expect(result?.isError).toBeUndefined();
      expect(result?.structuredContent).toEqual({
        to: input.to,
        chain: solChain,
        chain_name: "Solana",
        token: input.token,
        amount: "1.5",
        amount_atomic: "1500000000",
        signature: "MOCK_SIGNATURE",
      });
      expect(result?.structuredContent?.tx_hash).toBeUndefined();

      expect(spy).toHaveBeenCalledTimes(1);
      const args = spy.mock.calls[0]!;
      expect(args[0]).toBe("solana");
      expect(args[1]).toBe("5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
      expect(args[2]).toBe("Ez4hEGekBmzgYYgDuwXW68LNzRUdHSTU1A1CLvLyumjR");
      expect(args[3]).toBe(input.token);
    });

    test("surfaces dispatcher errors as MCP tool errors", async () => {
      spyOn(sdk, "executeTokenTransfer").mockReturnValue(
        errAsync({ message: "RPC unreachable" }) as any,
      );

      const result = (await setup().handler({
        to: "eip155:8453:0x1234567890123456789012345678901234567890",
        token: "eip155:8453:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        amount: "1",
        private_key: "0x1111111111111111111111111111111111111111111111111111111111111111",
      })) as any;

      expect(result?.isError).toBe(true);
      expect(result?.content?.[0]?.text).toContain("RPC unreachable");
    });
  });
});
