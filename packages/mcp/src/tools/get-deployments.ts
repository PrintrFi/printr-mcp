import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type PrintrClient, tokenId, toToolResponseAsync, unwrapResultAsync } from "@printr/sdk";
import { z } from "zod";
import { logToolExecution } from "~/lib/logging.js";

const xChainTransaction = z.object({
  chain_id: z.string().describe("CAIP-2 chain"),
  message_id: z.string().describe("Cross-chain message tracker"),
  transport: z.enum(["AXELAR"]).optional().describe("Protocol provider"),
});

const deployment = z.object({
  chain_id: z.string().describe("Target chain (CAIP-2)"),
  status: z.enum(["pending", "deploying", "live", "failed"]),
  contract_address: z.string().optional().describe("On-chain contract address (CAIP-10)"),
  transaction_id: z.string().optional().describe("On-chain tx hash"),
  graduation_completion_percent: z
    .number()
    .optional()
    .describe("Progress toward graduation (0–100)"),
  block_ts_secs: z.number().optional().describe("Block timestamp (unix)"),
  x_chain_transaction: xChainTransaction.optional(),
});

const inputSchema = z.object({
  id: tokenId,
});

const outputSchema = z.object({
  deployments: z.array(deployment).describe("Per-chain deployment statuses"),
});

export function registerGetDeploymentsTool(server: McpServer, client: PrintrClient) {
  server.registerTool(
    "printr_get_deployments",
    {
      description:
        "Check the deployment status of a Printr token across all its target chains. " +
        "Returns per-chain status (pending, deploying, live, failed), contract addresses, " +
        "transaction hashes, graduation progress, and cross-chain message details. " +
        "Use this to monitor a token after creation.",
      inputSchema,
      outputSchema,
    },
    logToolExecution("printr_get_deployments", async ({ id }) => {
      return toToolResponseAsync(
        unwrapResultAsync(client.GET("/tokens/{id}/deployments", { params: { path: { id } } })),
      );
    }),
  );
}
