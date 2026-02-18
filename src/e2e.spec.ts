import { beforeAll, describe, expect, it } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createPrintrClient } from "./lib/client.js";
import { log, logResult } from "./lib/test-helpers.js";
import { registerCreateTokenTool } from "./tools/create-token.js";
import { registerGetDeploymentsTool } from "./tools/get-deployments.js";
import { registerGetTokenTool } from "./tools/get-token.js";
import { registerQuoteTool } from "./tools/quote.js";

const API_TOKEN = process.env.PRINTR_API_KEY;
const API_BASE_URL = process.env.PRINTR_API_BASE_URL;
const API_TEST_TOKEN_ID = process.env.PRINTR_TEST_TOKEN_ID;

const hasCredentials = Boolean(API_TOKEN && API_BASE_URL);

describe.skipIf(!hasCredentials)("E2E: Printr API", () => {
  let client: Client;

  beforeAll(async () => {
    log(`[setup] base_url=${API_BASE_URL}`);

    const printrClient = createPrintrClient({
      apiKey: API_TOKEN!,
      baseUrl: API_BASE_URL!,
    });

    const server = new McpServer({ name: "printr-e2e", version: "0.1.0" });

    registerQuoteTool(server, printrClient);
    registerCreateTokenTool(server, printrClient);
    registerGetTokenTool(server, printrClient);
    registerGetDeploymentsTool(server, printrClient);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: "e2e-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(clientTransport);

    log("[setup] MCP client connected");
  });

  it("lists all registered tools", async () => {
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name);
    log("[listTools]", names);

    expect(names).toContain("printr_quote");
    expect(names).toContain("printr_create_token");
    expect(names).toContain("printr_get_token");
    expect(names).toContain("printr_get_deployments");
  });

  describe("printr_quote", () => {
    it("returns a quote for a single-chain deployment on Base", async () => {
      const result = await client.callTool({
        name: "printr_quote",
        arguments: {
          chains: ["eip155:8453"],
          initial_buy: { supply_percent: 1 },
        },
      });

      logResult("quote/supply_percent", result);

      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toBeDefined();

      const quote = result.structuredContent as {
        id: string;
        router: string;
        assets: unknown[];
        costs: unknown[];
        total: { cost_usd: number };
      };

      expect(quote.id).toBeString();
      expect(quote.router).toBeString();
      expect(quote.assets.length).toBeGreaterThan(0);
      expect(quote.costs.length).toBeGreaterThan(0);
      expect(quote.total.cost_usd).toBeGreaterThan(0);
    });

    it("returns a quote with spend_usd initial buy", async () => {
      const result = await client.callTool({
        name: "printr_quote",
        arguments: {
          chains: ["eip155:8453"],
          initial_buy: { spend_usd: 10 },
        },
      });

      logResult("quote/spend_usd", result);

      expect(result.isError).toBeUndefined();

      const quote = result.structuredContent as {
        costs: unknown[];
        total: { cost_usd: number };
      };

      expect(quote.costs.length).toBeGreaterThan(0);
      expect(quote.total.cost_usd).toBeGreaterThan(0);
    });

    it("returns an error for an unsupported chain", async () => {
      const result = await client.callTool({
        name: "printr_quote",
        arguments: {
          chains: ["eip155:999999"],
          initial_buy: { supply_percent: 1 },
        },
      });

      logResult("quote/unsupported_chain", result);

      expect(result.isError).toBe(true);
    });
  });

  describe("printr_get_token", () => {
    it.skipIf(!API_TEST_TOKEN_ID)("returns token details for a known token", async () => {
      const result = await client.callTool({
        name: "printr_get_token",
        arguments: { id: API_TEST_TOKEN_ID! },
      });

      logResult("get_token/known", result);

      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toBeDefined();

      const token = result.structuredContent as {
        id: string;
        name: string;
        symbol: string;
        chains: string[];
      };

      expect(token.id).toBeString();
      expect(token.name).toBeString();
      expect(token.symbol).toBeString();
      expect(token.chains.length).toBeGreaterThan(0);
    });

    it("returns an error for a nonexistent token", async () => {
      const result = await client.callTool({
        name: "printr_get_token",
        arguments: { id: "0x0000000000000000000000000000000000000000000000000000000000000000" },
      });

      logResult("get_token/nonexistent", result);

      expect(result.isError).toBe(true);
      expect(result.content).toBeDefined();
    });
  });

  describe("printr_get_deployments", () => {
    it.skipIf(!API_TEST_TOKEN_ID)("returns deployments for a known token", async () => {
      const result = await client.callTool({
        name: "printr_get_deployments",
        arguments: { id: API_TEST_TOKEN_ID! },
      });

      logResult("get_deployments/known", result);

      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toBeDefined();

      const data = result.structuredContent as {
        deployments: { chain_id: string; status: string }[];
      };

      expect(data.deployments.length).toBeGreaterThan(0);
      for (const d of data.deployments) {
        expect(d.chain_id).toBeString();
        expect(["pending", "deploying", "live", "failed"]).toContain(d.status);
      }
    });

    it("returns an error for a nonexistent token", async () => {
      const result = await client.callTool({
        name: "printr_get_deployments",
        arguments: { id: "0x0000000000000000000000000000000000000000000000000000000000000000" },
      });

      logResult("get_deployments/nonexistent", result);

      expect(result.isError).toBe(true);
      expect(result.content).toBeDefined();
    });
  });
});
