import { describe, expect, test } from "bun:test";
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
      input: { to: "invalid", token_address: "0xabc", amount: "1" },
      error: "Invalid CAIP-10",
    },
    {
      input: { to: "eip155:999999:0x1234", token_address: "0xabc", amount: "1" },
      error: "Unsupported",
    },
    {
      input: { to: "cosmos:hub:addr", token_address: "0xabc", amount: "1" },
      error: "Unsupported",
    },
    {
      input: { to: "eip155:8453:0x1234", token_address: "0xabc", amount: "1" },
      error: "No private key",
    },
  ])("rejects invalid input: $error", async ({ input, error }) => {
    const result = await setup().handler(input);
    expect((result as any)?.isError).toBe(true);
    expect((result as any)?.content?.[0]?.text).toContain(error);
  });
});
