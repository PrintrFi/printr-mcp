// Shared test utilities for tool tests

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PrintrClient } from "./client.js";
import { env } from "./env.js";

const verbose = env.VERBOSE === "1" || env.VERBOSE === "true";

export function log(...args: unknown[]) {
  if (verbose) console.log(...args);
}

export function logResult(label: string, result: Record<string, unknown>) {
  if (!verbose) return;
  const payload = result.structuredContent ?? result.content;
  console.log(`[${label}]`, result.isError ? "ERROR" : "OK", JSON.stringify(payload, null, 2));
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

export const mockSuccessResponse = <T>(data: T) => ({
  data,
  error: undefined,
  response: new Response(),
});

export const mockErrorResponse = (status: number, error: unknown) => ({
  data: undefined,
  error,
  response: new Response(null, { status }),
});
