// Shared test utilities for tool tests

import type { PrintrClient } from "./client.js";

type ToolConfig = {
  description: string;
  inputSchema: unknown;
  outputSchema: unknown;
};

type ToolHandler = (params: unknown) => Promise<unknown>;

export function createMockServer() {
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
  };
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
