import { describe, expect, test } from "bun:test";
import { createMockServer } from "../lib/test-helpers.js";
import { registerSupportedChainsTool } from "./supported-chains.js";

const setup = () => {
  const server = createMockServer();
  registerSupportedChainsTool(server as any);
  return server.getRegisteredTool()!;
};

describe("printr_supported_chains", () => {
  test("registers with correct name", () => {
    expect(setup().name).toBe("printr_supported_chains");
  });

  test("returns array of chains with required fields", () => {
    const result = setup().handler({});
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

  const expectedChains = [
    { id: "eip155:8453", name: "Base", symbol: "ETH" },
    { id: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", name: "Solana", symbol: "SOL" },
  ];

  test.each(expectedChains)("includes $name", ({ id, name, symbol }) => {
    const chains = (setup().handler({}) as any)?.structuredContent?.chains;
    const chain = chains?.find((c: any) => c.chain_id === id);

    expect(chain).toBeDefined();
    expect(chain?.name).toBe(name);
    expect(chain?.symbol).toBe(symbol);
  });
});
