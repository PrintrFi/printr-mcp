import { describe, expect, test } from "bun:test";
import { createMockServer } from "../lib/test-helpers.js";
import { registerClaimStakingRewardsTool } from "./claim-staking-rewards.js";

describe("printr_claim_staking_rewards", () => {
  const setup = () => {
    const server = createMockServer();
    registerClaimStakingRewardsTool(server as any);
    return server.getRegisteredTool()!;
  };

  test("registers tool with correct name", () => {
    expect(setup().name).toBe("printr_claim_staking_rewards");
  });

  test("input schema requires position and creation_tx", () => {
    const schema = setup().config.inputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("position");
    expect(schema.shape).toHaveProperty("creation_tx");
  });

  test("output schema has expected fields", () => {
    const schema = setup().config.outputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("position");
    expect(schema.shape).toHaveProperty("chain");
    expect(schema.shape).toHaveProperty("tx_hash");
    expect(schema.shape).toHaveProperty("tx_signature");
    expect(schema.shape).toHaveProperty("message");
  });

  test("description mentions dual-purpose (claim + withdraw)", () => {
    expect(setup().config.description.toLowerCase()).toContain("withdraw");
  });

  test("errors on invalid CAIP-10 position", async () => {
    const result = await setup().handler({ position: "not-a-caip10", creation_tx: "0xabc" });
    expect((result as any)?.isError).toBe(true);
    expect((result as any)?.content?.[0]?.text).toContain("Invalid CAIP-10");
  });
});
