import { describe, expect, it } from "bun:test";
import type { z } from "zod";
import { env } from "../lib/env.js";
import { createMockServer } from "../lib/test-helpers.js";
import { registerSignAndSubmitEvmTool } from "./sign-and-submit-evm.js";

const MOCK_PAYLOAD = {
  to: "eip155:8453:0x1234567890abcdef1234567890abcdef12345678",
  calldata: "0xdeadbeef",
  value: "1000000000000000",
  gas_limit: 200000,
};

const MOCK_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const MOCK_RPC_URL = "https://mainnet.base.org";

describe("registerSignAndSubmitEvmTool", () => {
  it("registers tool with correct name", () => {
    const mockServer = createMockServer();

    registerSignAndSubmitEvmTool(mockServer);

    const tool = mockServer.getRegisteredTool();
    expect(tool?.name).toBe("printr_sign_and_submit_evm");
  });

  it("registers tool with a description", () => {
    const mockServer = createMockServer();
    registerSignAndSubmitEvmTool(
      mockServer as unknown as Parameters<typeof registerSignAndSubmitEvmTool>[0],
    );

    const tool = mockServer.getRegisteredTool();
    expect(tool?.config.description).toBeString();
    expect(tool?.config.description.length).toBeGreaterThan(0);
  });

  describe("input schema validation", () => {
    it("accepts valid input", () => {
      const mockServer = createMockServer();
      registerSignAndSubmitEvmTool(
        mockServer as unknown as Parameters<typeof registerSignAndSubmitEvmTool>[0],
      );

      const tool = mockServer.getRegisteredTool();
      const schema = tool?.config.inputSchema as z.ZodObject<z.ZodRawShape>;
      const result = schema.safeParse({
        payload: MOCK_PAYLOAD,
        private_key: MOCK_PRIVATE_KEY,
        rpc_url: MOCK_RPC_URL,
      });

      expect(result.success).toBe(true);
    });

    it("accepts missing private_key (optional — falls back to env var)", () => {
      const mockServer = createMockServer();
      registerSignAndSubmitEvmTool(
        mockServer as Parameters<typeof registerSignAndSubmitEvmTool>[0],
      );

      const tool = mockServer.getRegisteredTool();
      const schema = tool?.config.inputSchema as z.ZodObject<z.ZodRawShape>;
      const result = schema.safeParse({ payload: MOCK_PAYLOAD, rpc_url: MOCK_RPC_URL });

      expect(result.success).toBe(true);
    });

    it("rejects missing rpc_url", () => {
      const mockServer = createMockServer();
      registerSignAndSubmitEvmTool(
        mockServer as Parameters<typeof registerSignAndSubmitEvmTool>[0],
      );

      const tool = mockServer.getRegisteredTool();
      const schema = tool?.config.inputSchema as z.ZodObject<z.ZodRawShape>;
      const result = schema.safeParse({ payload: MOCK_PAYLOAD, private_key: MOCK_PRIVATE_KEY });

      expect(result.success).toBe(false);
    });

    it("rejects invalid rpc_url (not a URL)", () => {
      const mockServer = createMockServer();
      registerSignAndSubmitEvmTool(
        mockServer as Parameters<typeof registerSignAndSubmitEvmTool>[0],
      );

      const tool = mockServer.getRegisteredTool();
      const schema = tool?.config.inputSchema as z.ZodObject<z.ZodRawShape>;
      const result = schema.safeParse({
        payload: MOCK_PAYLOAD,
        private_key: MOCK_PRIVATE_KEY,
        rpc_url: "not-a-url",
      });

      expect(result.success).toBe(false);
    });

    it("rejects missing payload.to", () => {
      const mockServer = createMockServer();
      registerSignAndSubmitEvmTool(
        mockServer as Parameters<typeof registerSignAndSubmitEvmTool>[0],
      );

      const tool = mockServer.getRegisteredTool();
      const schema = tool?.config.inputSchema as z.ZodObject<z.ZodRawShape>;
      const { to: _to, ...payloadWithoutTo } = MOCK_PAYLOAD;
      const result = schema.safeParse({
        payload: payloadWithoutTo,
        private_key: MOCK_PRIVATE_KEY,
        rpc_url: MOCK_RPC_URL,
      });

      expect(result.success).toBe(false);
    });
  });

  describe("handler", () => {
    it("returns isError when given an invalid CAIP-10 address", async () => {
      const mockServer = createMockServer();
      registerSignAndSubmitEvmTool(
        mockServer as Parameters<typeof registerSignAndSubmitEvmTool>[0],
      );

      const tool = mockServer.getRegisteredTool();
      const result = (await tool?.handler({
        payload: { ...MOCK_PAYLOAD, to: "not-a-caip10-address" },
        private_key: MOCK_PRIVATE_KEY,
        rpc_url: MOCK_RPC_URL,
      })) as { isError?: boolean; content: { text: string }[] };

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toInclude("CAIP-10");
    });

    it.skipIf(!!env.EVM_WALLET_PRIVATE_KEY)(
      "returns isError when private_key is omitted and EVM_WALLET_PRIVATE_KEY env var is not set",
      async () => {
        const mockServer = createMockServer();
        registerSignAndSubmitEvmTool(
          mockServer as Parameters<typeof registerSignAndSubmitEvmTool>[0],
        );

        const tool = mockServer.getRegisteredTool();
        const result = (await tool?.handler({
          payload: MOCK_PAYLOAD,
          rpc_url: MOCK_RPC_URL,
        })) as { isError?: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0]?.text).toInclude("private_key");
      },
    );
  });
});
