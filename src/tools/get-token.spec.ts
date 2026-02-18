import { describe, expect, it, test } from "bun:test";
import {
  createMockClient,
  createMockServer,
  mockErrorResponse,
  mockSuccessResponse,
} from "../lib/test-helpers.js";
import { registerGetTokenTool } from "./get-token.js";

describe("registerGetTokenTool", () => {
  const mockTokenData = {
    id: "0x1234567890abcdef",
    name: "Test Token",
    symbol: "TEST",
    description: "A test token",
    imageUrl: "https://example.com/image.png",
    creatorAddresses: ["eip155:8453:0xcreator"],
    chains: ["eip155:8453"],
    curveProperties: {
      homeChain: "eip155:8453",
      basePairAddresses: ["0xbase"],
      referenceAssetId: "eip155:8453:0xref",
      maxSupplyExponent: 8,
      completionThresholdBasisPoints: 10000,
      graduationThresholdRefAtomic: "69000000000000000000000",
      initialPriceRefAtomic: "1000000000000000",
    },
  };

  describe("tool registration", () => {
    it("registers tool with correct name", () => {
      const mockServer = createMockServer();
      const mockClient = createMockClient(() =>
        Promise.resolve(mockSuccessResponse(mockTokenData)),
      );

      registerGetTokenTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      expect(tool?.name).toBe("printr_get_token");
    });
  });

  describe("tool handler", () => {
    it("calls client GET with correct endpoint and path parameter", async () => {
      let capturedEndpoint: string | undefined;
      let capturedParams: any;

      const mockClient = createMockClient((endpoint, options) => {
        capturedEndpoint = endpoint;
        capturedParams = options?.params;
        return Promise.resolve(mockSuccessResponse(mockTokenData));
      });

      const mockServer = createMockServer();
      registerGetTokenTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      await tool?.handler({ id: "0x1234567890abcdef" });

      expect(capturedEndpoint).toBe("/tokens/{id}");
      expect(capturedParams?.path?.id).toBe("0x1234567890abcdef");
    });

    it("returns structured content on success", async () => {
      const mockClient = createMockClient(() =>
        Promise.resolve(mockSuccessResponse(mockTokenData)),
      );

      const mockServer = createMockServer();
      registerGetTokenTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      const result = await tool?.handler({ id: "0x1234567890abcdef" });

      expect((result as any)?.structuredContent).toEqual(mockTokenData);
      expect((result as any)?.content).toBeDefined();
    });

    it("handles API errors gracefully", async () => {
      const mockClient = createMockClient(() =>
        Promise.resolve(mockErrorResponse(404, { detail: "Token not found" })),
      );

      const mockServer = createMockServer();
      registerGetTokenTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      const result = await tool?.handler({ id: "0xnonexistent" });

      expect((result as any)?.isError).toBe(true);
      expect((result as any)?.content?.[0]?.text).toContain("404");
    });

    // Data-driven tests for different ID formats
    const idFormatCases = [
      {
        name: "hex token ID",
        id: "0x1234567890abcdef",
      },
      {
        name: "CAIP-10 address format",
        id: "eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      },
      {
        name: "Solana CAIP-10 address",
        id: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      },
    ];

    test.each(idFormatCases)("accepts $name", async ({ id }) => {
      let capturedId: string | undefined;

      const mockClient = createMockClient((_endpoint, options) => {
        capturedId = options?.params?.path?.id;
        return Promise.resolve(mockSuccessResponse(mockTokenData));
      });

      const mockServer = createMockServer();
      registerGetTokenTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      await tool?.handler({ id });

      expect(capturedId).toBe(id);
    });
  });
});
