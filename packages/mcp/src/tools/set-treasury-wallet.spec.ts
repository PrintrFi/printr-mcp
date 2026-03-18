import { describe, expect, test } from "bun:test";
import { createMockServer } from "../lib/test-helpers.js";
import { registerSetTreasuryWalletTool } from "./set-treasury-wallet.js";

describe("printr_set_treasury_wallet", () => {
  const setup = () => {
    const server = createMockServer();
    registerSetTreasuryWalletTool(server as any);
    return server.getRegisteredTool()!;
  };

  test("registers tool with correct name", () => {
    const tool = setup();
    expect(tool.name).toBe("printr_set_treasury_wallet");
  });

  test("has required input schema fields", () => {
    const tool = setup();
    const schema = tool.config.inputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("wallet_id");
    expect(schema.shape).toHaveProperty("password");
  });

  test("has required output schema fields", () => {
    const tool = setup();
    const schema = tool.config.outputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("address");
    expect(schema.shape).toHaveProperty("chain");
    expect(schema.shape).toHaveProperty("chain_type");
  });

  test("rejects non-existent wallet", async () => {
    const result = await setup().handler({ wallet_id: "non-existent-id", password: "test" });
    expect((result as any)?.isError).toBe(true);
    expect((result as any)?.content?.[0]?.text).toContain("not found");
  });
});
