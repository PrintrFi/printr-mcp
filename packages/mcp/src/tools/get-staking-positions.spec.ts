import { describe, expect, test } from "bun:test";
import { createMockServer } from "../lib/test-helpers.js";
import { registerGetStakingPositionsTool } from "./get-staking-positions.js";

describe("printr_get_staking_positions", () => {
  const setup = () => {
    const server = createMockServer();
    registerGetStakingPositionsTool(server as any);
    return server.getRegisteredTool()!;
  };

  test("registers tool with correct name", () => {
    expect(setup().name).toBe("printr_get_staking_positions");
  });

  test("input schema accepts optional token_id and owner", () => {
    const schema = setup().config.inputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("token_id");
    expect(schema.shape).toHaveProperty("owner");
  });

  test("output schema exposes claimable and claimed reward fields", () => {
    const schema = setup().config.outputSchema as { shape: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("positions");
    expect(schema.shape).toHaveProperty("total_positions");
    expect(schema.shape).toHaveProperty("total_with_claimable_rewards");
    expect(schema.shape).toHaveProperty("message");
  });

  test("errors when no treasury wallet is configured and no owner provided", async () => {
    const result = await setup().handler({});
    expect((result as any)?.isError).toBe(true);
    expect((result as any)?.content?.[0]?.text).toContain("No treasury wallet configured");
  });

  test("errors on invalid CAIP-10 owner", async () => {
    const result = await setup().handler({ owner: "not-a-caip10" });
    expect((result as any)?.isError).toBe(true);
    expect((result as any)?.content?.[0]?.text).toContain("Invalid CAIP-10");
  });
});
