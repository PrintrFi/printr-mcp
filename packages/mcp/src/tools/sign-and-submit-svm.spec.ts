import { describe, expect, it } from "bun:test";
import type { z } from "zod";
import { env } from "../lib/env.js";
import { createMockServer } from "../lib/test-helpers.js";
import { registerSignAndSubmitSvmTool } from "./sign-and-submit-svm.js";

const MOCK_IX = {
  program_id: "11111111111111111111111111111111",
  accounts: [
    { pubkey: "Ez4hEGekBmzgYYgDuwXW68LNzRUdHSTU1A1CLvLyumjR", is_signer: true, is_writable: true },
  ],
  data: "AQ==",
};

const MOCK_PAYLOAD = {
  ixs: [MOCK_IX],
  lookup_table: "AQhB2GD7ixcioSjLK6FdzdEUKMEfSWhGPDzicjF9qBqm",
  mint_address:
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:4hRGar9QsVTNpswpdp8TfwWXztc3MfUP9nEsSQuH7nsQ",
};

// A known valid 64-byte Solana keypair in base58 (test only — not funded)
const MOCK_PRIVATE_KEY =
  "5MaiiCavjCmn9Hs1o3eznqDEhRwxo7pXiAYez7keQUviNkigDeg4TC7iSqSdCznzi2CgXQAmNPJLxSSpzsGaPo3";

describe("registerSignAndSubmitSvmTool", () => {
  it("registers tool with correct name", () => {
    const mockServer = createMockServer();
    registerSignAndSubmitSvmTool(mockServer);

    const tool = mockServer.getRegisteredTool();
    expect(tool?.name).toBe("printr_sign_and_submit_svm");
  });

  it("registers tool with a description", () => {
    const mockServer = createMockServer();
    registerSignAndSubmitSvmTool(mockServer);

    const tool = mockServer.getRegisteredTool();
    expect(tool?.config.description).toBeString();
    expect(tool?.config.description.length).toBeGreaterThan(0);
  });

  describe("input schema validation", () => {
    it("accepts valid input with rpc_url", () => {
      const mockServer = createMockServer();
      registerSignAndSubmitSvmTool(mockServer);

      const tool = mockServer.getRegisteredTool();
      const schema = tool?.config.inputSchema as z.ZodObject<z.ZodRawShape>;
      const result = schema.safeParse({
        payload: MOCK_PAYLOAD,
        private_key: MOCK_PRIVATE_KEY,
        rpc_url: "https://api.mainnet-beta.solana.com",
      });

      expect(result.success).toBe(true);
    });

    it("accepts valid input without rpc_url (optional)", () => {
      const mockServer = createMockServer();
      registerSignAndSubmitSvmTool(mockServer);

      const tool = mockServer.getRegisteredTool();
      const schema = tool?.config.inputSchema as z.ZodObject<z.ZodRawShape>;
      const result = schema.safeParse({
        payload: MOCK_PAYLOAD,
        private_key: MOCK_PRIVATE_KEY,
      });

      expect(result.success).toBe(true);
    });

    it("accepts missing private_key (optional — falls back to env var)", () => {
      const mockServer = createMockServer();
      registerSignAndSubmitSvmTool(mockServer);

      const tool = mockServer.getRegisteredTool();
      const schema = tool?.config.inputSchema as z.ZodObject<z.ZodRawShape>;
      const result = schema.safeParse({ payload: MOCK_PAYLOAD });

      expect(result.success).toBe(true);
    });

    it("rejects empty ixs array", () => {
      const mockServer = createMockServer();
      registerSignAndSubmitSvmTool(mockServer);

      const tool = mockServer.getRegisteredTool();
      const schema = tool?.config.inputSchema as z.ZodObject<z.ZodRawShape>;
      const result = schema.safeParse({
        payload: { ...MOCK_PAYLOAD, ixs: [] },
        private_key: MOCK_PRIVATE_KEY,
      });

      expect(result.success).toBe(false);
    });

    it("rejects invalid rpc_url", () => {
      const mockServer = createMockServer();
      registerSignAndSubmitSvmTool(mockServer);

      const tool = mockServer.getRegisteredTool();
      const schema = tool?.config.inputSchema as z.ZodObject<z.ZodRawShape>;
      const result = schema.safeParse({
        payload: MOCK_PAYLOAD,
        private_key: MOCK_PRIVATE_KEY,
        rpc_url: "not-a-url",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("handler", () => {
    it("returns isError when given an invalid base58 private key", async () => {
      const mockServer = createMockServer();
      registerSignAndSubmitSvmTool(mockServer);

      const tool = mockServer.getRegisteredTool();
      const result = (await tool?.handler({
        payload: MOCK_PAYLOAD,
        private_key: "not-valid-base58!!!",
        rpc_url: "https://api.mainnet-beta.solana.com",
      })) as { isError?: boolean; content: { text: string }[] };

      expect(result.isError).toBe(true);
    });

    it.skipIf(!!env.SVM_WALLET_PRIVATE_KEY)(
      "returns isError when private_key is omitted and SVM_WALLET_PRIVATE_KEY env var is not set",
      async () => {
        const mockServer = createMockServer();
        registerSignAndSubmitSvmTool(mockServer);

        const tool = mockServer.getRegisteredTool();
        const result = (await tool?.handler({
          payload: MOCK_PAYLOAD,
        })) as { isError?: boolean; content: { text: string }[] };

        expect(result.isError).toBe(true);
        expect(result.content[0]?.text).toInclude("printr_wallet_unlock");
      },
    );
  });
});
