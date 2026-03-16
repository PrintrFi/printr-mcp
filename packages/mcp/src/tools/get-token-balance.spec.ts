import { describe, expect, test } from "bun:test";
import { createMockServer } from "../lib/test-helpers.js";
import { registerGetTokenBalanceTool } from "./get-token-balance.js";

describe("printr_get_token_balance", () => {
  const setup = () => {
    const server = createMockServer();
    registerGetTokenBalanceTool(server as any);
    return server.getRegisteredTool()!;
  };

  test.each([
    { input: { token: "invalid", wallet: "eip155:8453:0x1234" }, error: "Invalid CAIP-10" },
    { input: { token: "eip155:8453:0x1234", wallet: "eip155:1:0x5678" }, error: "same chain" },
    {
      input: { token: "eip155:999999:0x1234", wallet: "eip155:999999:0x5678" },
      error: "Unsupported",
    },
  ])("rejects invalid input: $error", async ({ input, error }) => {
    const result = await setup().handler(input);
    expect((result as any)?.isError).toBe(true);
    expect((result as any)?.content?.[0]?.text).toContain(error);
  });
});
