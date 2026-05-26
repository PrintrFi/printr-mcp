import { describe, expect, it, test } from "bun:test";
import { createMockServer } from "../lib/test-helpers.js";
import {
  buildTxField,
  generateWallet,
  registerFundDeploymentWalletTool,
} from "./fund-deployment-wallet.js";

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

  test("rejects when PRINTR_DEPLOYMENT_PASSWORD is not set or keystore is not writable", async () => {
    const result = await setup().handler({
      chain: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      amount: "0.1",
    });
    expect((result as any)?.isError).toBe(true);
    const errorText = (result as any)?.content?.[0]?.text;
    // Accept either error: missing password or directory not writable (CI environment)
    const isExpectedError =
      errorText.includes("PRINTR_DEPLOYMENT_PASSWORD") ||
      errorText.includes("Keystore directory not writable");
    expect(isExpectedError).toBe(true);
  });

  test("rejects invalid chain format", async () => {
    const result = await setup().handler({
      chain: "invalid-chain",
      amount: "0.1",
    });
    expect((result as any)?.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildTxField — pure helper
// ---------------------------------------------------------------------------

describe("buildTxField", () => {
  it("emits only `tx_signature` for an SVM result", () => {
    const out = buildTxField({ type: "svm", signature: "5K3..." });
    expect(out).toEqual({ tx_signature: "5K3..." });
    expect("tx_hash" in out).toBe(false);
  });

  it("emits only `tx_hash` for an EVM result", () => {
    const out = buildTxField({ type: "evm", tx_hash: "0xabc" });
    expect(out).toEqual({ tx_hash: "0xabc" });
    expect("tx_signature" in out).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateWallet — pure helper
// ---------------------------------------------------------------------------

describe("generateWallet", () => {
  it("returns a Solana keypair shape for `svm`", () => {
    const wallet = generateWallet("svm");
    expect(wallet.privateKey).toBeString();
    expect(wallet.address).toBeString();
    // Solana addresses are base58-encoded 32 bytes — 32 to 44 chars in the alphabet.
    expect(wallet.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    // Secret key is 64 bytes base58 → around 87–88 chars; loose bound to avoid flake.
    expect(wallet.privateKey.length).toBeGreaterThan(80);
  });

  it("returns an EVM keypair shape for `evm`", () => {
    const wallet = generateWallet("evm");
    expect(wallet.privateKey).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(wallet.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("returns distinct keypairs on consecutive calls (no module-level caching)", () => {
    const a = generateWallet("evm");
    const b = generateWallet("evm");
    expect(a.privateKey).not.toBe(b.privateKey);
    expect(a.address).not.toBe(b.address);

    const c = generateWallet("svm");
    const d = generateWallet("svm");
    expect(c.privateKey).not.toBe(d.privateKey);
    expect(c.address).not.toBe(d.address);
  });
});
