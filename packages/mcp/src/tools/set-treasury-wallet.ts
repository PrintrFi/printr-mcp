import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type ChainType,
  chainTypeFromCaip2,
  decryptKey,
  getWallet,
  normalisePrivateKey,
  toolError,
  toolOk,
} from "@printr/sdk";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { logToolExecution } from "~/lib/logging.js";
import { treasuryWallets } from "~/server/wallet-sessions.js";

function deriveAddress(privateKey: string, type: ChainType): string {
  if (type === "evm") return privateKeyToAccount(normalisePrivateKey(privateKey)).address;
  return Keypair.fromSecretKey(bs58.decode(privateKey)).publicKey.toBase58();
}

const inputSchema = z.object({
  wallet_id: z.string().describe("Keystore wallet ID to use as treasury — from printr_wallet_list"),
  password: z.string().describe("Password to decrypt the wallet"),
});

const outputSchema = z.object({
  address: z.string().describe("Treasury wallet address"),
  chain: z.string().describe("CAIP-2 chain ID"),
  chain_type: z.enum(["evm", "svm"]).describe("Chain type (evm or svm)"),
});

export function registerSetTreasuryWalletTool(server: McpServer): void {
  server.registerTool(
    "printr_set_treasury_wallet",
    {
      description:
        "Set a keystore wallet as the treasury wallet for funding deployment wallets. " +
        "Once set, printr_fund_deployment_wallet and printr_drain_deployment_wallet will use this wallet " +
        "instead of requiring environment variables. The treasury wallet persists for the session " +
        "(until the MCP server restarts). Use printr_wallet_new or printr_wallet_import to add wallets first.",
      inputSchema,
      outputSchema,
    },
    logToolExecution("printr_set_treasury_wallet", ({ wallet_id, password }) => {
      try {
        const entry = getWallet(wallet_id);
        if (!entry) return toolError(`Wallet ${wallet_id} not found in keystore.`);

        const decrypted = decryptKey(entry, password);
        if (decrypted.isErr()) return toolError("Incorrect password.");
        const privateKey = decrypted.value;

        const chainType = chainTypeFromCaip2(entry.chain);
        let address: string;
        try {
          address = deriveAddress(privateKey, chainType);
        } catch {
          return toolError("Failed to derive address from decrypted key.");
        }

        if (address.toLowerCase() !== entry.address.toLowerCase()) {
          return toolError("Decrypted key does not match stored address.");
        }

        treasuryWallets.set(chainType, { privateKey, address });
        return toolOk({ address: entry.address, chain: entry.chain, chain_type: chainType });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }),
  );
}
