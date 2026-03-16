import { describe, expect, test } from "bun:test";
import { createMockServer } from "../lib/test-helpers.js";
import { registerGetBalanceTool } from "./get-balance.js";

describe("printr_get_balance", () => {
  const setup = () => {
    const server = createMockServer();
    registerGetBalanceTool(server as any);
    return server.getRegisteredTool()!;
  };

  test.each([
    { input: { account: "invalid" }, error: "Invalid CAIP-10" },
    { input: { account: "eip155:999999:0x1234" }, error: "Unsupported" },
    { input: { account: "cosmos:hub:addr" }, error: "Unsupported" },
  ])("rejects invalid input: $error", async ({ input, error }) => {
    const result = await setup().handler(input);
    expect((result as any)?.isError).toBe(true);
    expect((result as any)?.content?.[0]?.text).toContain(error);
  });
});
