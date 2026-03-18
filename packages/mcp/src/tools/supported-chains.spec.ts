import { describe, expect, test } from "bun:test";
import { createMockServer } from "../lib/test-helpers.js";
import { registerSupportedChainsTool } from "./supported-chains.js";

describe("printr_supported_chains", () => {
  test("returns chains with required fields", async () => {
    const server = createMockServer();
    registerSupportedChainsTool(server as any);
    const result = await server.getRegisteredTool()!.handler({});
    const chains = (result as any)?.structuredContent?.chains;

    expect(Array.isArray(chains)).toBe(true);
    expect(chains.length).toBeGreaterThan(0);

    for (const chain of chains) {
      expect(chain).toHaveProperty("chain_id");
      expect(chain).toHaveProperty("name");
      expect(chain).toHaveProperty("symbol");
      expect(typeof chain.decimals).toBe("number");
      expect(typeof chain.has_rpc).toBe("boolean");
    }
  });
});
