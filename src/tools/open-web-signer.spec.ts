import { describe, expect, it } from "bun:test";
import type { z } from "zod";
import { createMockServer } from "../lib/test-helpers.js";
import { LOCAL_SESSION_ORIGIN } from "../server/index.js";
import { registerOpenWebSignerTool } from "./open-web-signer.js";

const MOCK_EVM_PAYLOAD = {
  to: "eip155:8453:0x1234567890abcdef1234567890abcdef12345678",
  calldata: "0xdeadbeef",
  value: "1000000000000000",
  gas_limit: 200000,
};

const MOCK_TOKEN_ID = "0xabcdef1234567890";

describe("registerOpenWebSignerTool", () => {
  it("registers tool with correct name", () => {
    const server = createMockServer();
    registerOpenWebSignerTool(server as any);
    expect(server.getRegisteredTool()?.name).toBe("printr_open_web_signer");
  });

  it("registers a non-empty description", () => {
    const server = createMockServer();
    registerOpenWebSignerTool(server as any);
    const desc = server.getRegisteredTool()?.config.description ?? "";
    expect(desc.length).toBeGreaterThan(0);
  });

  describe("input schema", () => {
    function getSchema(server: ReturnType<typeof createMockServer>) {
      return server.getRegisteredTool()?.config.inputSchema as z.ZodObject<z.ZodRawShape>;
    }

    it("accepts valid EVM input", () => {
      const server = createMockServer();
      registerOpenWebSignerTool(server as any);
      const result = getSchema(server).safeParse({
        chain_type: "evm",
        payload: MOCK_EVM_PAYLOAD,
        token_id: MOCK_TOKEN_ID,
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid SVM input with optional rpc_url", () => {
      const server = createMockServer();
      registerOpenWebSignerTool(server as any);
      const result = getSchema(server).safeParse({
        chain_type: "svm",
        payload: { ixs: [], mint_address: "solana:5eykt4...:SomePubKey" },
        token_id: MOCK_TOKEN_ID,
        rpc_url: "https://api.mainnet-beta.solana.com",
      });
      expect(result.success).toBe(true);
    });

    it("rejects unknown chain_type", () => {
      const server = createMockServer();
      registerOpenWebSignerTool(server as any);
      const result = getSchema(server).safeParse({
        chain_type: "btc",
        payload: {},
        token_id: MOCK_TOKEN_ID,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing token_id", () => {
      const server = createMockServer();
      registerOpenWebSignerTool(server as any);
      const result = getSchema(server).safeParse({
        chain_type: "evm",
        payload: MOCK_EVM_PAYLOAD,
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid rpc_url", () => {
      const server = createMockServer();
      registerOpenWebSignerTool(server as any);
      const result = getSchema(server).safeParse({
        chain_type: "evm",
        payload: MOCK_EVM_PAYLOAD,
        token_id: MOCK_TOKEN_ID,
        rpc_url: "not-a-url",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("handler", () => {
    async function callHandler(overrides: Record<string, unknown> = {}) {
      const server = createMockServer();
      registerOpenWebSignerTool(server as any);
      const tool = server.getRegisteredTool();
      return tool?.handler({
        chain_type: "evm",
        payload: MOCK_EVM_PAYLOAD,
        token_id: MOCK_TOKEN_ID,
        ...overrides,
      }) as Promise<{ structuredContent: Record<string, unknown>; content: { text: string }[] }>;
    }

    it("returns a URL pointing to app.printr.money by default", async () => {
      const result = await callHandler();
      const url = result.structuredContent?.url as string;
      expect(url).toStartWith("https://app.printr.money/sign");
    });

    it("URL includes session and api query params", async () => {
      const result = await callHandler();
      const url = new URL(result.structuredContent?.url as string);
      expect(url.searchParams.get("session")).toBeString();
      expect(url.searchParams.get("api")).toStartWith(`${LOCAL_SESSION_ORIGIN}:`);
    });

    it("returns session_token, api_port, and expires_at", async () => {
      const result = await callHandler();
      const sc = result.structuredContent;
      expect(sc?.session_token).toBeString();
      expect(sc?.api_port).toBeNumber();
      expect(sc?.expires_at).toBeGreaterThan(Date.now());
    });

    it("includes url in text content", async () => {
      const result = await callHandler();
      const text = result.content?.[0]?.text;
      expect(text).toBeString();
      expect(text).toInclude("http");
    });
  });
});
