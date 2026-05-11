import { describe, expect, test } from "bun:test";
import { createMockServer } from "../lib/test-helpers.js";
import { registerCreateStakePositionTool } from "./create-stake-position.js";

describe("printr_create_stake_position", () => {
  const setup = () => {
    const server = createMockServer();
    registerCreateStakePositionTool(server as any);
    return server.getRegisteredTool()!;
  };

  test("registers tool with correct name", () => {
    expect(setup().name).toBe("printr_create_stake_position");
  });

  test("input schema requires telecoin_id, asset, atomic, decimals, lock_period", () => {
    const schema = setup().config.inputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("telecoin_id");
    expect(schema.shape).toHaveProperty("asset");
    expect(schema.shape).toHaveProperty("atomic");
    expect(schema.shape).toHaveProperty("decimals");
    expect(schema.shape).toHaveProperty("lock_period");
  });

  test("output schema exposes telecoin_id, chain, payer and tx fields", () => {
    const schema = setup().config.outputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("telecoin_id");
    expect(schema.shape).toHaveProperty("chain");
    expect(schema.shape).toHaveProperty("payer");
    expect(schema.shape).toHaveProperty("lock_period");
    expect(schema.shape).toHaveProperty("staked_atomic");
    expect(schema.shape).toHaveProperty("tx_hash");
    expect(schema.shape).toHaveProperty("tx_signature");
    expect(schema.shape).toHaveProperty("message");
  });

  test("description mentions telecoin staking", () => {
    expect(setup().config.description.toLowerCase()).toContain("stake position");
  });

  test("errors on invalid CAIP-10 asset", async () => {
    const result = await setup().handler({
      telecoin_id: "0xabc",
      asset: "not-a-caip10",
      atomic: "1000",
      decimals: 9,
      lock_period: "30_DAYS",
    });
    expect((result as any)?.isError).toBe(true);
    expect((result as any)?.content?.[0]?.text).toContain("Invalid CAIP-10");
  });
});
