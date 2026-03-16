import { describe, expect, test } from "bun:test";
import { createMockServer } from "../lib/test-helpers.js";
import { registerDrainDeploymentWalletTool } from "./drain-deployment-wallet.js";

describe("printr_drain_deployment_wallet", () => {
  const setup = () => {
    const server = createMockServer();
    registerDrainDeploymentWalletTool(server as any);
    return server.getRegisteredTool()!;
  };

  test("registers tool with correct name", () => {
    const tool = setup();
    expect(tool.name).toBe("printr_drain_deployment_wallet");
  });

  test("has required input schema fields", () => {
    const tool = setup();
    const schema = tool.config.inputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("chain");
    expect(schema.shape).toHaveProperty("keep_minimum");
  });

  test("has required output schema fields", () => {
    const tool = setup();
    const schema = tool.config.outputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("drained_amount");
    expect(schema.shape).toHaveProperty("drained_atomic");
    expect(schema.shape).toHaveProperty("symbol");
    expect(schema.shape).toHaveProperty("from_address");
    expect(schema.shape).toHaveProperty("to_address");
    expect(schema.shape).toHaveProperty("remaining_balance");
  });

  test.each([
    {
      input: { chain: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" },
      error: "No active SVM deployment wallet",
      description: "no active SVM wallet",
    },
    {
      input: { chain: "eip155:8453" },
      error: "No active EVM deployment wallet",
      description: "no active EVM wallet",
    },
  ])("rejects when $description", async ({ input, error }) => {
    const result = await setup().handler(input);
    expect((result as any)?.isError).toBe(true);
    expect((result as any)?.content?.[0]?.text).toContain(error);
  });
});
