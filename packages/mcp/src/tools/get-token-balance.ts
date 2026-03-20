import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CHAIN_META,
  fetchTokenBalance,
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
  token: z
    .string()
    .describe(
      "CAIP-10 token contract address (e.g. 'eip155:8453:0xtoken...' or 'solana:5eykt...:mintAddress')",
    ),
  wallet: z
    .string()
    .describe("CAIP-10 wallet address to check balance for (must be on the same chain as token)"),
  rpc_url: z.string().url().optional().describe("Optional RPC endpoint override"),
});

const outputSchema = z.object({
  token: z.string().describe("The queried token CAIP-10 address"),
  wallet: z.string().describe("The wallet CAIP-10 address"),
  chain: z.string().describe("CAIP-2 chain ID"),
  chain_name: z.string().describe("Human-readable chain name"),
  balance_atomic: z.string().describe("Balance in atomic units (smallest denomination)"),
  balance_formatted: z.string().describe("Human-readable balance with decimals"),
  symbol: z.string().describe("Token symbol"),
  decimals: z.number().describe("Token decimals"),
});

type TokenBalanceOutput = z.infer<typeof outputSchema>;

const buildOutput = (
  token: string,
  wallet: string,
  chain: string,
  chainName: string,
  result: SimpleBalanceResult,
): TokenBalanceOutput => ({
  token,
  wallet,
  chain,
  chain_name: chainName,
  ...result,
});

export function registerGetTokenBalanceTool(server: McpServer): void {
  server.registerTool(
    "printr_get_token_balance",
    {
      description:
        "Get the balance of an ERC-20 or SPL token for a wallet address. " +
        "Use this to check token holdings before trading or transferring.",
      inputSchema,
      outputSchema,
    },
    logToolExecution("printr_get_token_balance", ({ token, wallet, rpc_url }) => {
      const tokenParsed = parseCaip10(token);
      if (!tokenParsed) return toolError(`Invalid CAIP-10 token address: ${token}`);
      const walletParsed = parseCaip10(wallet);
      if (!walletParsed) return toolError(`Invalid CAIP-10 wallet address: ${wallet}`);

      const tokenChain = toCaip2(tokenParsed);
      const walletChain = toCaip2(walletParsed);

      if (tokenChain !== walletChain) {
        return toolError(
          `Token and wallet must be on the same chain. Token: ${tokenChain}, Wallet: ${walletChain}`,
        );
      }

      const meta = getChainMeta(tokenChain);
      if (!meta) {
        return toolError(
          `Unsupported chain: ${tokenChain}. Supported: ${Object.keys(CHAIN_META).join(", ")}`,
        );
      }

      if (!isSupportedNamespace(tokenParsed.namespace)) {
        return toolError(
          `Unsupported namespace: ${tokenParsed.namespace}. Supported: eip155, solana`,
        );
      }

      return fetchTokenBalance(
        tokenParsed.namespace,
        tokenParsed.chainRef,
        tokenParsed.address,
        walletParsed.address,
        meta,
        rpc_url,
      ).match(
        (result) => toolOk(buildOutput(token, wallet, tokenChain, meta.name, result)),
        (e) =>
          toolError(
            e === "no_rpc"
              ? `No RPC URL available for ${tokenChain}. Pass rpc_url explicitly or set RPC_URLS.`
              : "Failed to fetch token balance",
          ),
      );
    }),
  );
}
