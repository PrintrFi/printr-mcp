// Shared test utilities for tool tests

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type ChainMeta, env, type PrintrClient } from "@printr/sdk";

// ---------------------------------------------------------------------------
// Chain metadata fixtures — shared by drain / fund / drain-deployment specs
// ---------------------------------------------------------------------------

/** Solana mainnet chain metadata, sized for unit-test reuse (9 decimals, SOL). */
export const SOL_META: ChainMeta = {
  name: "Solana",
  symbol: "SOL",
  decimals: 9,
};

/** Base chain metadata, sized for unit-test reuse (18 decimals, ETH gas token). */
export const BASE_META: ChainMeta = {
  name: "Base",
  symbol: "ETH",
  decimals: 18,
};

const verbose = env.VERBOSE === "1" || env.VERBOSE === "true";

export function log(...args: unknown[]) {
  if (verbose) {
    console.log(...args);
  }
}

export function logResult(label: string, result: Record<string, unknown>) {
  if (!verbose) {
    return;
  }
  const payload = result["structuredContent"] ?? result["content"];
  console.log(`[${label}]`, result["isError"] ? "ERROR" : "OK", JSON.stringify(payload, null, 2));
}

type ToolConfig = {
  description: string;
  inputSchema: unknown;
  outputSchema: unknown;
};

type ToolHandler = (params: unknown) => Promise<unknown>;

type MockMcpServer = McpServer & {
  registerTool: (name: string, config: ToolConfig, handler: ToolHandler) => void;
  getRegisteredTool: () => {
    name: string;
    config: ToolConfig;
    handler: ToolHandler;
  } | null;
};

export function createMockServer(): MockMcpServer {
  let registeredTool: {
    name: string;
    config: ToolConfig;
    handler: ToolHandler;
  } | null = null;

  return {
    registerTool: (name: string, config: ToolConfig, handler: ToolHandler) => {
      registeredTool = { name, config, handler };
    },
    getRegisteredTool: () => registeredTool,
  } as MockMcpServer;
}

type MockResponse = {
  data?: unknown;
  error?: unknown;
  response: Response;
};

export function createMockClient(
  mockImplementation: (endpoint: string, options?: unknown) => Promise<MockResponse>,
): PrintrClient {
  return {
    GET: mockImplementation,
    POST: mockImplementation,
  } as PrintrClient;
}

export const mockSuccessResponse = <T>(data: T): MockResponse => ({
  data,
  error: undefined,
  response: new Response(),
});

export const mockErrorResponse = (status: number, error: unknown): MockResponse => ({
  data: undefined,
  error,
  response: new Response(null, { status }),
});
