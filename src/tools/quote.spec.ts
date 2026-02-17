import { describe, expect, it, test } from "bun:test";
import {
  createMockClient,
  createMockServer,
  mockErrorResponse,
  mockSuccessResponse,
} from "../lib/test-helpers.js";
import { registerQuoteTool } from "./quote.js";

describe("registerQuoteTool", () => {
  const mockQuoteResponse = {
    id: "q1",
    router: "uniswap",
    assets: [],
    costs: [],
    total: {
      asset_id: "eip155:8453:0x0000",
      cost_usd: 1.5,
      cost_asset_atomic: "1500000000000000000",
    },
  };

  describe("tool registration", () => {
    it("registers tool with correct name and description", () => {
      const mockServer = createMockServer();
      const mockClient = createMockClient(() =>
        Promise.resolve(mockSuccessResponse({ quote: mockQuoteResponse })),
      );

      registerQuoteTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      expect(tool?.name).toBe("printr_quote");
      expect(tool?.config.description).toContain("cost estimate");
      expect(tool?.config.description).toContain("printr_create_token");
      expect(tool?.config.inputSchema).toBeDefined();
      expect(tool?.config.outputSchema).toBeDefined();
    });
  });

  describe("tool handler", () => {
    it("calls client POST with correct endpoint and parameters", async () => {
      let capturedEndpoint: string | undefined;
      let capturedBody: unknown;

      const mockClient = createMockClient((endpoint, options) => {
        capturedEndpoint = endpoint;
        capturedBody = options?.body;
        return Promise.resolve(mockSuccessResponse({ quote: mockQuoteResponse }));
      });

      const mockServer = createMockServer();
      registerQuoteTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      await tool?.handler({
        chains: ["eip155:8453"],
        initial_buy: { spend_usd: 50 },
      });

      expect(capturedEndpoint).toBe("/print/quote");
      expect(capturedBody).toEqual({
        chains: ["eip155:8453"],
        initial_buy: { spend_usd: 50 },
      });
    });

    it("returns structured content on success", async () => {
      const mockClient = createMockClient(() =>
        Promise.resolve(mockSuccessResponse({ quote: mockQuoteResponse })),
      );

      const mockServer = createMockServer();
      registerQuoteTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      const result = await tool?.handler({
        chains: ["eip155:8453"],
        initial_buy: { spend_usd: 50 },
      });

      expect((result as any)?.structuredContent).toEqual(mockQuoteResponse);
      expect((result as any)?.content).toBeDefined();
      expect((result as any)?.content?.[0]?.type).toBe("text");
    });

    it("handles API errors gracefully", async () => {
      const mockClient = createMockClient(() =>
        Promise.resolve(mockErrorResponse(400, { detail: "Insufficient funds" })),
      );

      const mockServer = createMockServer();
      registerQuoteTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      const result = await tool?.handler({
        chains: ["eip155:8453"],
        initial_buy: { spend_usd: 50 },
      });

      expect((result as any)?.isError).toBe(true);
      expect((result as any)?.content?.[0]?.text).toContain("400");
    });

    // Data-driven tests for different parameter combinations
    const parameterCases = [
      {
        name: "supply_percent with graduation threshold",
        input: {
          chains: ["eip155:8453"],
          initial_buy: { supply_percent: 10 },
          graduation_threshold_per_chain_usd: 250000,
        },
      },
      {
        name: "spend_usd only",
        input: {
          chains: ["eip155:8453"],
          initial_buy: { spend_usd: 100 },
        },
      },
      {
        name: "spend_native with multiple chains",
        input: {
          chains: ["eip155:8453", "eip155:1", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
          initial_buy: { spend_native: "1000000000000000000" },
        },
      },
      {
        name: "single chain with default graduation threshold",
        input: {
          chains: ["eip155:1"],
          initial_buy: { supply_percent: 5 },
        },
      },
    ];

    test.each(parameterCases)("passes parameters correctly: $name", async ({ input }) => {
      let capturedBody: unknown;

      const mockClient = createMockClient((_endpoint, options) => {
        capturedBody = options?.body;
        return Promise.resolve(mockSuccessResponse({ quote: mockQuoteResponse }));
      });

      const mockServer = createMockServer();
      registerQuoteTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      await tool?.handler(input);

      expect(capturedBody).toEqual(input);
    });
  });
});
