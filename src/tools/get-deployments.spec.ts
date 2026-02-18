import { describe, expect, it, test } from "bun:test";
import {
  createMockClient,
  createMockServer,
  mockErrorResponse,
  mockSuccessResponse,
} from "../lib/test-helpers.js";
import { registerGetDeploymentsTool } from "./get-deployments.js";

describe("registerGetDeploymentsTool", () => {
  const mockDeploymentsData = {
    deployments: [
      {
        chain_id: "eip155:8453",
        status: "live" as const,
        contract_address: "eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        transaction_id: "0xtxhash123",
        graduation_completion_percent: 45.5,
        block_ts_secs: 1703001600,
      },
      {
        chain_id: "eip155:1",
        status: "deploying" as const,
        x_chain_transaction: {
          chain_id: "eip155:8453",
          message_id: "0xmsg123",
          transport: "AXELAR" as const,
        },
      },
      {
        chain_id: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        status: "pending" as const,
      },
    ],
  };

  describe("tool registration", () => {
    it("registers tool with correct name", () => {
      const mockServer = createMockServer();
      const mockClient = createMockClient(() =>
        Promise.resolve(mockSuccessResponse(mockDeploymentsData)),
      );

      registerGetDeploymentsTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      expect(tool?.name).toBe("printr_get_deployments");
    });
  });

  describe("tool handler", () => {
    it("calls client GET with correct endpoint and path parameter", async () => {
      let capturedEndpoint: string | undefined;
      let capturedParams: any;

      const mockClient = createMockClient((endpoint, options) => {
        capturedEndpoint = endpoint;
        capturedParams = options?.params;
        return Promise.resolve(mockSuccessResponse(mockDeploymentsData));
      });

      const mockServer = createMockServer();
      registerGetDeploymentsTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      await tool?.handler({ id: "0x1234567890abcdef" });

      expect(capturedEndpoint).toBe("/tokens/{id}/deployments");
      expect(capturedParams?.path?.id).toBe("0x1234567890abcdef");
    });

    it("returns structured content on success", async () => {
      const mockClient = createMockClient(() =>
        Promise.resolve(mockSuccessResponse(mockDeploymentsData)),
      );

      const mockServer = createMockServer();
      registerGetDeploymentsTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      const result = await tool?.handler({ id: "0x1234567890abcdef" });

      expect((result as any)?.structuredContent).toEqual(mockDeploymentsData);
      expect((result as any)?.content).toBeDefined();
    });

    it("handles API errors gracefully", async () => {
      const mockClient = createMockClient(() =>
        Promise.resolve(mockErrorResponse(404, { detail: "Token not found" })),
      );

      const mockServer = createMockServer();
      registerGetDeploymentsTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      const result = await tool?.handler({ id: "0xnonexistent" });

      expect((result as any)?.isError).toBe(true);
      expect((result as any)?.content?.[0]?.text).toContain("404");
    });

    // Data-driven tests for different deployment statuses
    const statusCases = [
      {
        name: "all deployments live",
        deployments: [
          {
            chain_id: "eip155:8453",
            status: "live" as const,
            contract_address: "eip155:8453:0xaddr",
            transaction_id: "0xtx",
            graduation_completion_percent: 100,
            block_ts_secs: 1703001600,
          },
        ],
      },
      {
        name: "deployment in progress",
        deployments: [
          {
            chain_id: "eip155:8453",
            status: "deploying" as const,
            x_chain_transaction: {
              chain_id: "eip155:1",
              message_id: "0xmsg",
              transport: "AXELAR" as const,
            },
          },
        ],
      },
      {
        name: "failed deployment",
        deployments: [
          {
            chain_id: "eip155:8453",
            status: "failed" as const,
          },
        ],
      },
      {
        name: "mixed statuses",
        deployments: [
          { chain_id: "eip155:8453", status: "live" as const },
          { chain_id: "eip155:1", status: "deploying" as const },
          { chain_id: "eip155:42161", status: "pending" as const },
        ],
      },
    ];

    test.each(statusCases)("handles $name", async ({ deployments }) => {
      const mockClient = createMockClient(() =>
        Promise.resolve(mockSuccessResponse({ deployments })),
      );

      const mockServer = createMockServer();
      registerGetDeploymentsTool(mockServer as any, mockClient);

      const tool = mockServer.getRegisteredTool();
      const result = await tool?.handler({ id: "0xtest" });

      expect((result as any)?.structuredContent?.deployments).toEqual(deployments);
    });
  });
});
