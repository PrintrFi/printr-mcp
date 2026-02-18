import { beforeAll, describe, expect, it } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createMockClient, mockSuccessResponse } from "~/lib/test-helpers.js";
import { registerCreateTokenTool } from "~/tools/create-token.js";
import { registerGetDeploymentsTool } from "~/tools/get-deployments.js";
import { registerGetTokenTool } from "~/tools/get-token.js";
import { registerQuoteTool } from "~/tools/quote.js";

describe("MCP Server Integration", () => {
  let client: Client;
  let server: McpServer;

  beforeAll(async () => {
    // Create mock Printr API client with responses matching the output schemas
    const mockPrintrClient = createMockClient(async (endpoint: string, _options?: unknown) => {
      // Mock successful responses for smoke testing
      if (endpoint === "/print/quote") {
        return mockSuccessResponse({
          quote: {
            id: "quote-123",
            router: "test-router",
            assets: [
              {
                id: "eip155:1:0x0000000000000000000000000000000000000000",
                name: "Ethereum",
                symbol: "ETH",
                decimals: 18,
                price_usd: 2000,
              },
            ],
            initial_buy_amount: "1000000000000000000",
            costs: [
              {
                asset_id: "eip155:1:0x0000000000000000000000000000000000000000",
                cost_usd: 50,
                cost_asset_atomic: "25000000000000000",
                description: "Deployment cost",
              },
            ],
            total: {
              asset_id: "eip155:1:0x0000000000000000000000000000000000000000",
              cost_usd: 100,
              cost_asset_atomic: "50000000000000000",
            },
          },
        });
      }
      if (endpoint.includes("/tokens/")) {
        return mockSuccessResponse({
          id: "0x123abc",
          name: "Test Token",
          symbol: "TEST",
          description: "Test description",
          imageUrl: "https://example.com/image.png",
          creatorAddresses: ["eip155:1:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"],
          chains: ["eip155:1"],
          curveProperties: {
            homeChain: "eip155:1",
            basePairAddresses: ["eip155:1:0x0000000000000000000000000000000000000000"],
            referenceAssetId: "eip155:1:0x0000000000000000000000000000000000000000",
            maxSupplyExponent: 9,
            completionThresholdBasisPoints: 10000,
            graduationThresholdRefAtomic: "69000000000000000000000",
            initialPriceRefAtomic: "1000000000000",
          },
        });
      }
      if (endpoint === "/print") {
        return mockSuccessResponse({
          token_id: "0x456def",
          payload: { hash: "0x789" },
          quote: {
            id: "quote-456",
            router: "test-router",
            assets: [],
            costs: [],
            total: {
              asset_id: "eip155:1:0x0000000000000000000000000000000000000000",
              cost_usd: 100,
              cost_asset_atomic: "50000000000000000",
            },
          },
        });
      }
      return mockSuccessResponse({});
    });

    // Set up server with mock client
    server = new McpServer({
      name: "printr-test",
      version: "0.1.0",
    });

    registerQuoteTool(server, mockPrintrClient);
    registerCreateTokenTool(server, mockPrintrClient);
    registerGetTokenTool(server, mockPrintrClient);
    registerGetDeploymentsTool(server, mockPrintrClient);

    // Create linked transports for client-server communication
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Connect server
    await server.connect(serverTransport);

    // Create and connect client
    client = new Client(
      {
        name: "test-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    await client.connect(clientTransport);
  });

  it("lists all registered tools", async () => {
    const result = await client.listTools();

    expect(result.tools).toBeDefined();
    expect(result.tools.length).toBe(4);

    const toolNames = result.tools.map((tool) => tool.name);
    expect(toolNames).toContain("printr_quote");
    expect(toolNames).toContain("printr_create_token");
    expect(toolNames).toContain("printr_get_token");
    expect(toolNames).toContain("printr_get_deployments");
  });

  it("returns tool schema with description", async () => {
    const result = await client.listTools();
    const quoteTool = result.tools.find((t) => t.name === "printr_quote");

    expect(quoteTool).toBeDefined();
    expect(quoteTool?.description).toContain("cost estimate");
    expect(quoteTool?.inputSchema).toBeDefined();
  });

  it("can call printr_quote tool", async () => {
    const result = await client.callTool({
      name: "printr_quote",
      arguments: {
        chains: ["eip155:1"],
        initial_buy: { supply_percent: 5 },
      },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
  });

  it("can call printr_get_token tool", async () => {
    const result = await client.callTool({
      name: "printr_get_token",
      arguments: {
        id: "test-token-id",
      },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content).toBeDefined();
  });

  it("handles tool errors gracefully", async () => {
    // Mock server that returns errors
    const errorClient = createMockClient(async () => ({
      data: undefined,
      error: { message: "Not found" },
      response: new Response(null, { status: 404 }),
    }));

    const errorServer = new McpServer({
      name: "error-test",
      version: "0.1.0",
    });
    registerGetTokenTool(errorServer, errorClient);

    const [errClientTransport, errServerTransport] = InMemoryTransport.createLinkedPair();
    await errorServer.connect(errServerTransport);

    const errTestClient = new Client(
      { name: "error-test-client", version: "1.0.0" },
      { capabilities: {} },
    );
    await errTestClient.connect(errClientTransport);

    const result = await errTestClient.callTool({
      name: "printr_get_token",
      arguments: { id: "nonexistent" },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toBeDefined();
  });
});
