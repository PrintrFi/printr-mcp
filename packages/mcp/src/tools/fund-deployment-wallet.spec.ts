import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  });

  test("does not have label or password input fields (uses master password)", () => {
    const tool = setup();
    const schema = tool.config.inputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).not.toHaveProperty("label");
    expect(schema.shape).not.toHaveProperty("password");
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
  });

  test("does not have generated_password output field (uses master password)", () => {
    const tool = setup();
    const schema = tool.config.outputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).not.toHaveProperty("generated_password");
  });

  test("wallet_id is a required output field (not optional)", () => {
    const tool = setup();
    const schema = tool.config.outputSchema as {
      shape: Record<string, { isOptional: () => boolean }>;
    };
    expect(schema.shape.wallet_id.isOptional()).toBe(false);
  });

  test("rejects when PRINTR_DEPLOYMENT_PASSWORD is not set", async () => {
    // Set up temp directory for wallet store to avoid CI environment issues
    const tempDir = mkdtempSync(join(tmpdir(), "printr-test-"));
    const originalWalletStore = process.env.PRINTR_WALLET_STORE;
    process.env.PRINTR_WALLET_STORE = tempDir;

    try {
      const result = await setup().handler({
        chain: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        amount: "0.1",
      });
      expect((result as any)?.isError).toBe(true);
      expect((result as any)?.content?.[0]?.text).toContain("PRINTR_DEPLOYMENT_PASSWORD");
    } finally {
      // Restore original env var
      if (originalWalletStore) {
        process.env.PRINTR_WALLET_STORE = originalWalletStore;
      } else {
        delete process.env.PRINTR_WALLET_STORE;
      }
    }
  });

  test("rejects invalid chain format", async () => {
    const result = await setup().handler({
      chain: "invalid-chain",
      amount: "0.1",
    });
    expect((result as any)?.isError).toBe(true);
  });
});
