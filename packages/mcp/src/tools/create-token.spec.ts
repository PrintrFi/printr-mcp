import { afterAll, beforeAll, describe, expect, it, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import {
  createMockClient,
  createMockServer,
  mockErrorResponse,
  mockSuccessResponse,
} from "../lib/test-helpers.js";
import { registerCreateTokenTool } from "./create-token.js";

const TMP_DIR = "/tmp/printr-create-token-test";

async function makeJpegFile(name: string, width = 64, height = 64): Promise<string> {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  const path = join(TMP_DIR, name);
  await writeFile(path, buf);
  return path;
}

beforeAll(async () => {
  await mkdir(TMP_DIR, { recursive: true });
});

afterAll(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

describe("registerCreateTokenTool", () => {
  const mockTokenResponse = {
    token_id: "0x1234567890abcdef",
    payload: {
      hash: "0xabcdef",
      to: "eip155:8453:0x0000",
      calldata: "0x123",
      value: "0",
      gas_limit: 21000,
    },
    quote: {
      id: "q1",
      router: "uniswap",
      assets: [],
      costs: [],
      total: {
        asset_id: "eip155:8453:0x0000",
        cost_usd: 1.5,
        cost_asset_atomic: "1500000000000000000",
      },
    },
  };

  describe("tool registration", () => {
    it("registers tool with correct name", () => {
      const mockServer = createMockServer();
      const mockClient = createMockClient(() =>
        Promise.resolve(mockSuccessResponse(mockTokenResponse)),
      );

      registerCreateTokenTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      expect(tool?.name).toBe("printr_create_token");
    });
  });

  describe("tool handler", () => {
    it("calls client POST with correct endpoint and parameters", async () => {
      let capturedEndpoint: string | undefined;
      let capturedBody: unknown;

      const mockClient = createMockClient((endpoint, options) => {
        capturedEndpoint = endpoint;
        capturedBody = options?.body;
        return Promise.resolve(mockSuccessResponse(mockTokenResponse));
      });

      const mockServer = createMockServer();
      registerCreateTokenTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      const params = {
        creator_accounts: ["eip155:8453:0xcreator"],
        name: "Test Token",
        symbol: "TEST",
        description: "A test token",
        image: "base64encodedimage",
        chains: ["eip155:8453"],
        initial_buy: { spend_usd: 100 },
      };

      await tool?.handler(params);

      expect(capturedEndpoint).toBe("/print");
      expect(capturedBody).toEqual(params);
    });

    it("resolves image_path to a base64 image before calling the API", async () => {
      const imagePath = await makeJpegFile("token.jpg");
      let capturedBody: Record<string, unknown> | undefined;

      const mockClient = createMockClient((_endpoint, options) => {
        capturedBody = options?.body as Record<string, unknown>;
        return Promise.resolve(mockSuccessResponse(mockTokenResponse));
      });

      const mockServer = createMockServer();
      registerCreateTokenTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      const result = await tool?.handler({
        creator_accounts: ["eip155:8453:0xcreator"],
        name: "Test Token",
        symbol: "TEST",
        description: "A test token",
        image_path: imagePath,
        chains: ["eip155:8453"],
        initial_buy: { spend_usd: 100 },
      });

      expect((result as any)?.isError).toBeUndefined();
      // image_path must be stripped; image must be a non-empty base64 string
      expect(capturedBody?.image_path).toBeUndefined();
      expect(capturedBody?.image).toBeString();
      expect((capturedBody?.image as string).length).toBeGreaterThan(0);
    });

    it("returns error for a non-existent image_path", async () => {
      const mockClient = createMockClient(() =>
        Promise.resolve(mockSuccessResponse(mockTokenResponse)),
      );

      const mockServer = createMockServer();
      registerCreateTokenTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      const result = await tool?.handler({
        creator_accounts: ["eip155:8453:0xcreator"],
        name: "Test Token",
        symbol: "TEST",
        description: "A test token",
        image_path: "/tmp/does-not-exist-99999.jpg",
        chains: ["eip155:8453"],
        initial_buy: { spend_usd: 100 },
      });

      expect((result as any)?.isError).toBe(true);
      expect((result as any)?.content?.[0]?.text).toMatch(/Cannot read image file/);
    });

    it("returns error when no image source is available and OPENROUTER_API_KEY is unset", async () => {
      const mockClient = createMockClient(() =>
        Promise.resolve(mockSuccessResponse(mockTokenResponse)),
      );

      const mockServer = createMockServer();
      registerCreateTokenTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      const result = await tool?.handler({
        creator_accounts: ["eip155:8453:0xcreator"],
        name: "Test Token",
        symbol: "TEST",
        description: "A test token",
        chains: ["eip155:8453"],
        initial_buy: { spend_usd: 100 },
      });

      expect((result as any)?.isError).toBe(true);
      expect((result as any)?.content?.[0]?.text).toMatch(/No image provided/);
    });

    it("returns structured content on success", async () => {
      const mockClient = createMockClient(() =>
        Promise.resolve(mockSuccessResponse(mockTokenResponse)),
      );

      const mockServer = createMockServer();
      registerCreateTokenTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      const result = await tool?.handler({
        creator_accounts: ["eip155:8453:0xcreator"],
        name: "Test Token",
        symbol: "TEST",
        description: "A test token",
        image: "base64encodedimage",
        chains: ["eip155:8453"],
        initial_buy: { spend_usd: 100 },
      });

      expect((result as any)?.structuredContent).toEqual(mockTokenResponse);
      expect((result as any)?.content).toBeDefined();
    });

    it("handles API errors gracefully", async () => {
      const mockClient = createMockClient(() =>
        Promise.resolve(mockErrorResponse(400, { detail: "Invalid image format" })),
      );

      const mockServer = createMockServer();
      registerCreateTokenTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      const result = await tool?.handler({
        creator_accounts: ["eip155:8453:0xcreator"],
        name: "Test Token",
        symbol: "TEST",
        description: "A test token",
        image: "invalid",
        chains: ["eip155:8453"],
        initial_buy: { spend_usd: 100 },
      });

      expect((result as any)?.isError).toBe(true);
      expect((result as any)?.content?.[0]?.text).toContain("400");
    });

    // Data-driven tests for different parameter combinations
    const parameterCases = [
      {
        name: "with external links",
        input: {
          creator_accounts: ["eip155:8453:0xcreator"],
          name: "Test Token",
          symbol: "TEST",
          description: "A test token",
          image: "base64",
          chains: ["eip155:8453"],
          initial_buy: { spend_usd: 100 },
          external_links: {
            website: "https://example.com",
            x: "https://x.com/test",
          },
        },
      },
      {
        name: "with graduation threshold",
        input: {
          creator_accounts: ["eip155:8453:0xcreator"],
          name: "Premium Token",
          symbol: "PREM",
          description: "Premium token with higher threshold",
          image: "base64",
          chains: ["eip155:8453"],
          initial_buy: { supply_percent: 10 },
          graduation_threshold_per_chain_usd: 250000,
        },
      },
      {
        name: "multi-chain deployment",
        input: {
          creator_accounts: [
            "eip155:8453:0xcreator1",
            "eip155:1:0xcreator2",
            "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:0xcreator3",
          ],
          name: "Multi Token",
          symbol: "MULTI",
          description: "Cross-chain token",
          image: "base64",
          chains: ["eip155:8453", "eip155:1", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
          initial_buy: { spend_native: "1000000000000000000" },
        },
      },
    ];

    test.each(parameterCases)("passes parameters correctly: $name", async ({ input }) => {
      let capturedBody: unknown;

      const mockClient = createMockClient((_endpoint, options) => {
        capturedBody = options?.body;
        return Promise.resolve(mockSuccessResponse(mockTokenResponse));
      });

      const mockServer = createMockServer();
      registerCreateTokenTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      await tool?.handler(input);

      expect(capturedBody).toEqual(input);
    });
  });
});
