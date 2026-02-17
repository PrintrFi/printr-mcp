// Shared test utilities for tool tests

export function createMockServer() {
  let registeredTool: {
    name: string;
    config: {
      description: string;
      inputSchema: unknown;
      outputSchema: unknown;
    };
    handler: (params: unknown) => Promise<unknown>;
  } | null = null;

  return {
    registerTool: (name: string, config: any, handler: any) => {
      registeredTool = { name, config, handler };
    },
    getRegisteredTool: () => registeredTool,
  };
}

export function createMockClient(
  mockImplementation: (endpoint: string, options?: any) => Promise<any>,
) {
  return {
    GET: mockImplementation,
    POST: mockImplementation,
  } as any;
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
