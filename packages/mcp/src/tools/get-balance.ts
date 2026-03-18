import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CHAIN_META,
  fetchNativeBalance,
  getChainMeta,
  isSupportedNamespace,
  parseCaip10,
  type SimpleBalanceResult,
  toCaip2,
  toolError,
  toolOk,
} from "@printr/sdk";
import { z } from "zod";
import { logToolExecution } from "~/lib/logging.js";

const inputSchema = z.object({
  account: z
    .string()
    .describe(
      "CAIP-10 account address (e.g. 'eip155:8453:0x742d...' for Base, " +
        "'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:7S3P4H...' for Solana)",
    ),
  rpc_url: z.string().url().optional().describe("Optional RPC endpoint override"),
});

const outputSchema = z.object({
  account: z.string().describe("The queried CAIP-10 account"),
  chain: z.string().describe("CAIP-2 chain ID"),
  chain_name: z.string().describe("Human-readable chain name"),
  balance_atomic: z.string().describe("Balance in atomic units (wei, lamports, etc.)"),
  balance_formatted: z.string().describe("Human-readable balance with decimals"),
  symbol: z.string().describe("Native token symbol"),
  decimals: z.number().describe("Token decimals"),
});

type BalanceOutput = z.infer<typeof outputSchema>;

const buildOutput = (
  account: string,
  caip2: string,
  chainName: string,
  result: SimpleBalanceResult,
): BalanceOutput => ({
  account,
  chain: caip2,
  chain_name: chainName,
  ...result,
});

export function registerGetBalanceTool(server: McpServer): void {
  server.registerTool(
    "printr_get_balance",
    {
      description:
        "Get the native token balance of a wallet address. " +
        "Supports EVM chains (ETH, BNB, AVAX, etc.) and Solana. " +
        "Use this to check if a wallet has sufficient funds before creating or trading tokens.",
      inputSchema,
      outputSchema,
    },
    logToolExecution("printr_get_balance", async ({ account, rpc_url }) => {
      try {
        const parsed = parseCaip10(account);
        const caip2 = toCaip2(parsed);
        const meta = getChainMeta(caip2);

        if (!meta) {
          return toolError(
            `Unsupported chain: ${caip2}. Supported chains: ${Object.keys(CHAIN_META).join(", ")}`,
          );
        }

        if (!isSupportedNamespace(parsed.namespace)) {
          return toolError(`Unsupported namespace: ${parsed.namespace}. Supported: eip155, solana`);
        }

        const result = await fetchNativeBalance(
          parsed.namespace,
          parsed.chainRef,
          parsed.address,
          meta,
          rpc_url,
        );

        return toolOk(buildOutput(account, caip2, meta.name, result));
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }),
  );
}
