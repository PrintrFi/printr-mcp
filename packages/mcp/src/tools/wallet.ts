import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  addWallet,
  type ChainType,
  chainTypeFromCaip2,
  decryptKey,
  encryptKey,
  getWallet,
  listWallets,
  normalisePrivateKey,
  removeWallet,
  removeWallets,
  toolError,
  toolOk,
} from "@printr/sdk";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { match } from "ts-pattern";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { logToolExecution } from "~/lib/logging.js";
import { activeWallets } from "~/server/wallet-sessions.js";

function deriveAddress(privateKey: string, type: ChainType): string {
  if (type === "evm") return privateKeyToAccount(normalisePrivateKey(privateKey)).address;
  return Keypair.fromSecretKey(bs58.decode(privateKey)).publicKey.toBase58();
}

export function registerWalletTools(server: McpServer): void {
  server.registerTool(
    "printr_wallet_new",
    {
      description:
        "Generate a new wallet keypair for the given chain, encrypt it with a password, " +
        "and save it to the local keystore (~/.printr/wallets.json). " +
        "Returns the new address and wallet ID. " +
        "The wallet is immediately set as the active wallet for its chain type. " +
        "Fund the address with native tokens before signing transactions.",
      inputSchema: z.object({
        chain: z
          .string()
          .describe(
            "CAIP-2 chain ID (e.g. 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' or 'eip155:8453')",
          ),
        label: z.string().min(1).describe("Human-readable label for this wallet"),
        password: z.string().min(1).describe("Password used to encrypt the private key at rest"),
      }),
      outputSchema: z.object({
        address: z.string().describe("New wallet address"),
        chain: z.string().describe("CAIP-2 chain ID"),
        wallet_id: z.string().describe("Keystore wallet ID — use with printr_wallet_unlock"),
      }),
    },
    logToolExecution("printr_wallet_new", ({ chain, label, password }) => {
      try {
        const chainType = chainTypeFromCaip2(chain);
        const { privateKey, address } = match(chainType)
          .with("svm", () => {
            const kp = Keypair.generate();
            return { privateKey: bs58.encode(kp.secretKey), address: kp.publicKey.toBase58() };
          })
          .with("evm", () => {
            const privateKey = generatePrivateKey();
            return {
              privateKey,
              address: privateKeyToAccount(normalisePrivateKey(privateKey)).address,
            };
          })
          .exhaustive();
        const id = randomUUID();
        addWallet({
          id,
          label,
          chain,
          address,
          createdAt: Date.now(),
          ...encryptKey(privateKey, password),
        });
        activeWallets.set(chainType, { privateKey, address });
        return toolOk({ address, chain, wallet_id: id });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }),
  );

  server.registerTool(
    "printr_wallet_import",
    {
      description:
        "Import an existing private key as the active wallet for its chain. " +
        "Optionally encrypt and save it to the local keystore by providing a label and password. " +
        "The wallet is set active immediately.",
      inputSchema: z.object({
        chain: z.string().describe("CAIP-2 chain ID"),
        private_key: z
          .string()
          .describe("Raw private key — EVM: hex (with or without 0x), SVM: base58 64-byte keypair"),
        label: z
          .string()
          .optional()
          .describe("Label for saving to keystore (required together with password)"),
        password: z.string().optional().describe("Password to encrypt and save to keystore"),
      }),
      outputSchema: z.object({
        address: z.string().describe("Derived wallet address"),
        saved: z.boolean().describe("Whether the wallet was saved to the keystore"),
        wallet_id: z.string().optional().describe("Keystore wallet ID if saved"),
      }),
    },
    logToolExecution("printr_wallet_import", ({ chain, private_key, label, password }) => {
      try {
        const chainType = chainTypeFromCaip2(chain);
        let address: string;
        try {
          address = deriveAddress(private_key, chainType);
        } catch {
          return toolError("Invalid private key format.");
        }
        let saved = false;
        let wallet_id: string | undefined;
        if (label && password) {
          wallet_id = randomUUID();
          addWallet({
            id: wallet_id,
            label,
            chain,
            address,
            createdAt: Date.now(),
            ...encryptKey(private_key, password),
          });
          saved = true;
        }
        activeWallets.set(chainType, { privateKey: private_key, address });
        return toolOk({ address, saved, ...(wallet_id ? { wallet_id } : {}) });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }),
  );

  server.registerTool(
    "printr_wallet_list",
    {
      description:
        "List wallets saved in the local keystore (~/.printr/wallets.json). " +
        "Private keys are never returned.",
      inputSchema: z.object({
        chain: z.string().optional().describe("Filter by CAIP-2 chain ID"),
      }),
      outputSchema: z.object({
        wallets: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            chain: z.string(),
            address: z.string(),
            created_at: z.number(),
          }),
        ),
      }),
    },
    logToolExecution("printr_wallet_list", ({ chain }) => {
      const wallets = listWallets(chain).map(({ id, label, chain: c, address, createdAt }) => ({
        id,
        label,
        chain: c,
        address,
        created_at: createdAt,
      }));
      return toolOk({ wallets });
    }),
  );

  server.registerTool(
    "printr_wallet_unlock",
    {
      description:
        "Decrypt a stored keystore wallet with its password and set it as the active wallet " +
        "for its chain type. Once unlocked, signing tools use it automatically for the rest " +
        "of the session (until the MCP server restarts).",
      inputSchema: z.object({
        wallet_id: z.string().describe("Keystore wallet ID — from printr_wallet_list"),
        password: z.string().describe("Decryption password"),
      }),
      outputSchema: z.object({
        address: z.string().describe("Wallet address"),
        chain: z.string().describe("CAIP-2 chain ID"),
      }),
    },
    logToolExecution("printr_wallet_unlock", ({ wallet_id, password }) => {
      const entry = getWallet(wallet_id);
      if (!entry) return toolError(`Wallet ${wallet_id} not found in keystore.`);
      return decryptKey(entry, password).match(
        (privateKey) => {
          const chainType = chainTypeFromCaip2(entry.chain);
          activeWallets.set(chainType, { privateKey, address: entry.address });
          return toolOk({ address: entry.address, chain: entry.chain });
        },
        () => toolError("Incorrect password."),
      );
    }),
  );

  server.registerTool(
    "printr_wallet_remove",
    {
      description:
        "Remove a wallet from the local keystore. " +
        "Does not affect the active wallet for the current session.",
      inputSchema: z.object({
        wallet_id: z.string().describe("Keystore wallet ID — from printr_wallet_list"),
      }),
      outputSchema: z.object({
        ok: z.boolean(),
      }),
    },
    logToolExecution("printr_wallet_remove", ({ wallet_id }) => {
      const removed = removeWallet(wallet_id);
      if (!removed) return toolError(`Wallet ${wallet_id} not found in keystore.`);
      return toolOk({ ok: true });
    }),
  );

  server.registerTool(
    "printr_wallet_bulk_remove",
    {
      description:
        "Remove multiple wallets from the local keystore at once. " +
        "Does not affect active wallets for the current session.",
      inputSchema: z.object({
        wallet_ids: z.array(z.string()).min(1).describe("List of keystore wallet IDs to remove"),
      }),
      outputSchema: z.object({
        removed_count: z.number().describe("Number of wallets actually removed"),
      }),
    },
    logToolExecution("printr_wallet_bulk_remove", ({ wallet_ids }) => {
      try {
        const count = removeWallets(wallet_ids);
        return toolOk({ removed_count: count });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }),
  );
}
