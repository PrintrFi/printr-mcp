import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CHAIN_META,
  type ChainMeta,
  executeTransfer,
  getChainMeta,
  isSupportedNamespace,
  namespaceToChainType,
  parseCaip10,
  toCaip2,
  toToolResponseAsync,
} from "@printr/sdk";
import { err, fromThrowable, ok, type Result } from "neverthrow";
import { z } from "zod";
import { activeWallets } from "~/server/wallet-sessions.js";

type TransferToolError = { message: string };

const safeParseCaip10 = fromThrowable(
  parseCaip10,
  (e): TransferToolError => ({ message: e instanceof Error ? e.message : String(e) }),
);

const getPrivateKey = (namespace: string, providedKey?: string): string | null => {
  if (providedKey) return providedKey;
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
  return safeParseCaip10(to).andThen((parsed) => {
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
  });
}

const inputSchema = z.object({
  to: z
    .string()
    .describe("CAIP-10 recipient address (e.g. 'eip155:8453:0x...' or 'solana:5eykt...:pubkey')"),
  amount: z
    .string()
    .describe("Amount to send in human-readable units (e.g. '0.1' for 0.1 ETH or SOL)"),
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
  amount: z.string().describe("Amount sent in human-readable units"),
  amount_atomic: z.string().describe("Amount sent in atomic units"),
  symbol: z.string().describe("Native token symbol"),
  tx_hash: z.string().optional().describe("EVM transaction hash"),
  signature: z.string().optional().describe("Solana transaction signature"),
});

export function registerTransferTool(server: McpServer): void {
  server.registerTool(
    "printr_transfer",
    {
      description:
        "Transfer native tokens (ETH, SOL, BNB, etc.) to another address. " +
        "Uses the active wallet from printr_wallet_unlock if no private_key is provided.",
      inputSchema,
      outputSchema,
    },
    ({ to, amount, private_key, rpc_url }) =>
      toToolResponseAsync(
        validateInputs(to, private_key).asyncAndThen(
          ({ namespace, chainRef, address, caip2, meta, key }) =>
            executeTransfer(namespace, chainRef, address, amount, key, meta, rpc_url).map(
              (result) => ({
                to,
                chain: caip2,
                chain_name: meta.name,
                amount,
                symbol: meta.symbol,
                amount_atomic: result.amount_atomic,
                ...(result.type === "svm"
                  ? { signature: result.signature }
                  : { tx_hash: result.tx_hash }),
              }),
            ),
        ),
      ),
  );
}
