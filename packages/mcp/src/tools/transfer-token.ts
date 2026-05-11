import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CHAIN_META,
  type ChainMeta,
  executeTokenTransfer,
  getChainMeta,
  isSupportedNamespace,
  namespaceToChainType,
  parseCaip10,
  toCaip2,
  toToolResponseAsync,
} from "@printr/sdk";
import { err, ok, type Result } from "neverthrow";
import { match } from "ts-pattern";
import { z } from "zod";
import { logToolExecution } from "~/lib/logging.js";
import { activeWallets } from "~/server/wallet-sessions.js";

type TransferToolError = { message: string };

const getPrivateKey = (namespace: string, providedKey?: string): string | null => {
  if (providedKey) {
    return providedKey;
  }
  return activeWallets.get(namespaceToChainType(namespace))?.privateKey ?? null;
};

type ParsedInput = {
  namespace: string;
  chainRef: string;
  address: string;
  caip2: string;
  meta: ChainMeta;
  key: string;
};

function validateInputs(
  to: string,
  privateKey: string | undefined,
): Result<ParsedInput, TransferToolError> {
  const parsed = parseCaip10(to);
  if (!parsed) {
    return err({ message: `Invalid CAIP-10 address: ${to}` });
  }

  const caip2 = toCaip2(parsed);
  const meta = getChainMeta(caip2);

  if (!meta) {
    return err({
      message: `Unsupported chain: ${caip2}. Supported: ${Object.keys(CHAIN_META).join(", ")}`,
    });
  }

  if (!isSupportedNamespace(parsed.namespace)) {
    return err({
      message: `Unsupported namespace: ${parsed.namespace}. Supported: eip155, solana`,
    });
  }

  const key = getPrivateKey(parsed.namespace, privateKey);
  if (!key) {
    const chainType = namespaceToChainType(parsed.namespace).toUpperCase();
    return err({
      message:
        `No private key provided and no active ${chainType} wallet. ` +
        "Use printr_wallet_unlock first or provide private_key.",
    });
  }

  return ok({
    namespace: parsed.namespace,
    chainRef: parsed.chainRef,
    address: parsed.address,
    caip2,
    meta,
    key,
  });
}

const inputSchema = z.object({
  to: z
    .string()
    .describe(
      "CAIP-10 recipient address (e.g. 'eip155:8453:0x...' or 'solana:5eykt...:pubkey'). " +
        "On Solana this MUST be the recipient's owner wallet, not an associated token account — " +
        "the ATA is derived automatically.",
    ),
  token: z
    .string()
    .describe(
      "CAIP-10 token ID (e.g. 'eip155:8453:0xtoken...' or 'solana:5eykt...:mintAddress'). " +
        "Must be on the same chain as the recipient. Decimals are auto-detected from the " +
        "token contract / mint.",
    ),
  amount: z.string().describe("Amount to send in human-readable units (e.g. '1.5' for 1.5 USDC)"),
  private_key: z
    .string()
    .optional()
    .describe(
      "Private key to sign the transaction. EVM: hex (with or without 0x). SVM: base58 keypair. " +
        "If omitted, uses the active wallet from printr_wallet_unlock.",
    ),
  rpc_url: z.string().url().optional().describe("Optional RPC endpoint override"),
});

const outputSchema = z.object({
  to: z.string().describe("Recipient CAIP-10 address"),
  chain: z.string().describe("CAIP-2 chain ID"),
  chain_name: z.string().describe("Human-readable chain name"),
  token: z.string().describe("CAIP-10 token ID"),
  amount: z.string().describe("Amount sent in human-readable units"),
  amount_atomic: z.string().describe("Amount sent in atomic units"),
  tx_hash: z.string().optional().describe("EVM transaction hash"),
  signature: z.string().optional().describe("Solana transaction signature"),
});

/**
 * Register the `printr_transfer_token` MCP tool.
 *
 * Exposes fungible-token transfers (ERC20 on EVM chains, SPL tokens on Solana) over MCP.
 * Decimals are auto-detected from the token contract or mint, and the recipient's SPL
 * associated token account is created on demand if it does not exist. Falls back to the
 * unlocked active wallet when `private_key` is omitted.
 *
 * @param server - MCP server instance to register the tool against
 */
export function registerTransferTokenTool(server: McpServer): void {
  server.registerTool(
    "printr_transfer_token",
    {
      description:
        "Transfer fungible tokens (ERC20 on EVM chains, SPL tokens on Solana) to another address. " +
        "Auto-detects token decimals and creates the recipient's SPL associated token account if missing. " +
        "Uses the active wallet from printr_wallet_unlock if no private_key is provided.",
      inputSchema,
      outputSchema,
    },
    logToolExecution("printr_transfer_token", ({ to, token, amount, private_key, rpc_url }) =>
      toToolResponseAsync(
        validateInputs(to, private_key).asyncAndThen(
          ({ namespace, chainRef, address, caip2, meta, key }) =>
            executeTokenTransfer(
              namespace,
              chainRef,
              address,
              token,
              amount,
              key,
              meta,
              rpc_url,
            ).map((result) => ({
              to,
              chain: caip2,
              chain_name: meta.name,
              token,
              amount,
              amount_atomic: result.amount_atomic,
              ...match(result)
                .with({ type: "svm" }, (r) => ({ signature: r.signature }))
                .with({ type: "evm" }, (r) => ({ tx_hash: r.tx_hash }))
                .exhaustive(),
            })),
        ),
      ),
    ),
  );
}
