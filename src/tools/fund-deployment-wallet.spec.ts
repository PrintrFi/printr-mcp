import { describe, expect, test } from "bun:test";
import { createMockServer } from "../lib/test-helpers.js";
import { registerFundDeploymentWalletTool } from "./fund-deployment-wallet.js";

describe("printr_fund_deployment_wallet", () => {
  const setup = () => {
    const server = createMockServer();
    registerFundDeploymentWalletTool(server as any);
    return server.getRegisteredTool()!;
  };

  test("registers tool with correct name", () => {
    const tool = setup();
    expect(tool.name).toBe("printr_fund_deployment_wallet");
  });

  test("has required input schema fields", () => {
    const tool = setup();
    const schema = tool.config.inputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("chain");
    expect(schema.shape).toHaveProperty("amount");
    expect(schema.shape).toHaveProperty("label");
    expect(schema.shape).toHaveProperty("password");
  });

  test("has required output schema fields", () => {
    const tool = setup();
    const schema = tool.config.outputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("address");
    expect(schema.shape).toHaveProperty("chain");
    expect(schema.shape).toHaveProperty("chain_name");
    expect(schema.shape).toHaveProperty("amount_funded");
    expect(schema.shape).toHaveProperty("amount_atomic");
    expect(schema.shape).toHaveProperty("symbol");
    expect(schema.shape).toHaveProperty("wallet_id");
    expect(schema.shape).toHaveProperty("generated_password");
  });

  test("wallet_id is a required output field (not optional)", () => {
    const tool = setup();
    const schema = tool.config.outputSchema as {
      shape: Record<string, { isOptional: () => boolean }>;
    };
    expect(schema.shape.wallet_id.isOptional()).toBe(false);
  });

  test("generated_password is an optional output field", () => {
    const tool = setup();
    const schema = tool.config.outputSchema as {
      shape: Record<string, { isOptional: () => boolean }>;
    };
    expect(schema.shape.generated_password.isOptional()).toBe(true);
  });

  test.each([
    {
      input: { chain: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", amount: "0.1" },
      error: "SVM_WALLET_PRIVATE_KEY",
      description: "missing SVM treasury key",
    },
    {
      input: { chain: "eip155:8453", amount: "0.1" },
      error: "EVM_WALLET_PRIVATE_KEY",
      description: "missing EVM treasury key",
    },
  ])("rejects when $description", async ({ input, error }) => {
    const result = await setup().handler(input);
    expect((result as any)?.isError).toBe(true);
    expect((result as any)?.content?.[0]?.text).toContain(error);
  });

  test("rejects invalid chain format", async () => {
    const result = await setup().handler({
      chain: "invalid-chain",
      amount: "0.1",
    });
    expect((result as any)?.isError).toBe(true);
  });
});
