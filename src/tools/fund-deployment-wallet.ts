import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { type ChainType, chainTypeFromCaip2, parseCaip2 } from "~/lib/caip.js";
import { getChainMeta } from "~/lib/chains.js";
import { toolError, toolOk } from "~/lib/client.js";
import { normalisePrivateKey } from "~/lib/evm.js";
import { addWallet, encryptKey } from "~/lib/keystore.js";
import { executeTransfer } from "~/lib/transfer.js";
import { getTreasuryErrorMsg, getTreasuryKey } from "~/lib/treasury.js";
import { activeWallets } from "~/server/wallet-sessions.js";

function generateWallet(type: ChainType): { privateKey: string; address: string } {
  if (type === "svm") {
    const kp = Keypair.generate();
    return { privateKey: bs58.encode(kp.secretKey), address: kp.publicKey.toBase58() };
  }
  const privateKey = generatePrivateKey();
  return { privateKey, address: privateKeyToAccount(normalisePrivateKey(privateKey)).address };
}

function saveToKeystore(
  label: string,
  password: string,
  chain: string,
  address: string,
  privateKey: string,
): string {
  const wallet_id = randomUUID();
  addWallet({
    id: wallet_id,
    label,
    chain,
    address,
    createdAt: Date.now(),
    ...encryptKey(privateKey, password),
  });
  return wallet_id;
}

function buildTxField(
  result: { type: "svm"; signature: string } | { type: "evm"; tx_hash: string },
) {
  return result.type === "svm" ? { tx_signature: result.signature } : { tx_hash: result.tx_hash };
}

function maybeSaveWallet(
  label: string | undefined,
  password: string | undefined,
  chain: string,
  address: string,
  privateKey: string,
): string | undefined {
  if (label && password) {
    return saveToKeystore(label, password, chain, address, privateKey);
  }
  return undefined;
}

const inputSchema = z.object({
  chain: z
    .string()
    .describe(
      "CAIP-2 chain ID (e.g. 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' for Solana mainnet)",
    ),
  amount: z.string().describe("Amount to fund in human-readable units (e.g. '0.6' for 0.6 SOL)"),
  label: z.string().optional().describe("Optional label for saving the wallet to keystore"),
  password: z
    .string()
    .optional()
    .describe("Password to encrypt the wallet (required if label is provided)"),
});

const outputSchema = z.object({
  address: z.string().describe("New deployment wallet address"),
  chain: z.string().describe("CAIP-2 chain ID"),
  chain_name: z.string().describe("Human-readable chain name"),
  amount_funded: z.string().describe("Amount transferred to the new wallet"),
  amount_atomic: z.string().describe("Amount in atomic units (lamports/wei)"),
  symbol: z.string().describe("Native token symbol"),
  tx_signature: z.string().optional().describe("Solana transaction signature"),
  tx_hash: z.string().optional().describe("EVM transaction hash"),
  wallet_id: z.string().optional().describe("Keystore wallet ID if saved"),
});

export function registerFundDeploymentWalletTool(server: McpServer): void {
  server.registerTool(
    "printr_fund_deployment_wallet",
    {
      description:
        "Create a fresh deployment wallet and fund it from the treasury wallet. " +
        "Uses the SVM_WALLET_PRIVATE_KEY or EVM_WALLET_PRIVATE_KEY environment variable " +
        "as the funding source. The new wallet is set as the active wallet for signing. " +
        "Use this before printr_launch_token to deploy tokens without exposing the treasury.",
      inputSchema,
      outputSchema,
    },
    async ({ chain, amount, label, password }) => {
      try {
        const type = chainTypeFromCaip2(chain);

        const treasuryKey = getTreasuryKey(type);
        if (!treasuryKey) {
          return toolError(getTreasuryErrorMsg(type));
        }

        const meta = getChainMeta(chain);
        if (!meta) return toolError(`Unsupported chain: ${chain}`);

        const parsed = parseCaip2(chain);
        if (!parsed)
          return toolError(`Invalid CAIP-2 chain format: ${chain}. Expected 'namespace:chainRef'.`);

        const { privateKey, address } = generateWallet(type);
        const wallet_id = maybeSaveWallet(label, password, chain, address, privateKey);

        const result = await executeTransfer(
          parsed.namespace,
          parsed.chainRef,
          address,
          amount,
          treasuryKey,
          meta,
        );
        activeWallets.set(type, { privateKey, address });

        return toolOk({
          address,
          chain,
          chain_name: meta.name,
          amount_funded: amount,
          amount_atomic: result.amount_atomic,
          symbol: meta.symbol,
          ...buildTxField(result),
          ...(wallet_id ? { wallet_id } : {}),
        });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    },
  );
}
