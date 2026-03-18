import { randomUUID } from "node:crypto";
import { accessSync, constants } from "node:fs";
import { dirname } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  addWallet,
  type ChainType,
  chainTypeFromCaip2,
  encryptKey,
  executeTransfer,
  getChainMeta,
  keystorePath,
  normalisePrivateKey,
  parseCaip2,
  setActiveWalletId,
  setLastDeploymentWalletId,
  toToolResponseAsync,
} from "@printr/sdk";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { err, errAsync, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { env } from "~/lib/env.js";
import { getTreasuryErrorMsg, getTreasuryKey } from "~/lib/treasury.js";
import { activeWallets } from "~/server/wallet-sessions.js";

type FundError = { message: string };

const MIN_PASSWORD_LENGTH = 16;

function getDeploymentPassword(): Result<string, FundError> {
  const password = env.PRINTR_DEPLOYMENT_PASSWORD;
  if (!password) {
    return err({
      message:
        "PRINTR_DEPLOYMENT_PASSWORD environment variable is required. " +
        "This password encrypts deployment wallet private keys for recovery. " +
        "Generate one with: openssl rand -base64 32",
    });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return err({
      message:
        `PRINTR_DEPLOYMENT_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters. ` +
        "Use a strong random password: openssl rand -base64 32",
    });
  }
  return ok(password);
}

function verifyKeystoreWritable(): ResultAsync<void, FundError> {
  const path = keystorePath();
  const dir = dirname(path);
  try {
    accessSync(dir, constants.W_OK);
    return okAsync(undefined);
  } catch {
    return errAsync({
      message:
        `Keystore directory not writable: ${dir}. ` +
        "Deployment wallets must be persisted to prevent fund loss. " +
        "Check directory permissions or set PRINTR_WALLET_STORE env var.",
    });
  }
}

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

type PersistedWallet = {
  wallet_id: string;
  privateKey: string;
  address: string;
};

function persistWallet(
  masterPassword: string,
  chain: string,
  type: ChainType,
): Result<PersistedWallet, FundError> {
  const { privateKey, address } = generateWallet(type);
  const label = `deploy-${address.slice(0, 8)}`;

  try {
    const wallet_id = saveToKeystore(label, masterPassword, chain, address, privateKey);
    return ok({ wallet_id, privateKey, address });
  } catch (e) {
    return err({
      message:
        `Failed to persist wallet to keystore: ${e instanceof Error ? e.message : String(e)}. ` +
        "Aborting to prevent fund loss. The wallet was NOT funded.",
    });
  }
}

const inputSchema = z.object({
  chain: z
    .string()
    .describe(
      "CAIP-2 chain ID (e.g. 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' for Solana mainnet)",
    ),
  amount: z.string().describe("Amount to fund in human-readable units (e.g. '0.6' for 0.6 SOL)"),
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
  wallet_id: z.string().describe("Keystore wallet ID for the persisted wallet"),
});

function validateInputs(chain: string): Result<
  {
    type: ChainType;
    treasuryKey: string;
    meta: NonNullable<ReturnType<typeof getChainMeta>>;
    parsed: NonNullable<ReturnType<typeof parseCaip2>>;
    masterPassword: string;
  },
  FundError
> {
  return getDeploymentPassword().andThen((masterPassword) => {
    const type = chainTypeFromCaip2(chain);

    const treasuryKey = getTreasuryKey(type);
    if (!treasuryKey) {
      return err({ message: getTreasuryErrorMsg(type) });
    }

    const meta = getChainMeta(chain);
    if (!meta) {
      return err({ message: `Unsupported chain: ${chain}` });
    }

    const parsed = parseCaip2(chain);
    if (!parsed) {
      return err({
        message: `Invalid CAIP-2 chain format: ${chain}. Expected 'namespace:chainRef'.`,
      });
    }

    return ok({ type, treasuryKey, meta, parsed, masterPassword });
  });
}

export function registerFundDeploymentWalletTool(server: McpServer): void {
  server.registerTool(
    "printr_fund_deployment_wallet",
    {
      description:
        "Create a fresh deployment wallet and fund it from the treasury wallet. " +
        "Uses the SVM_WALLET_PRIVATE_KEY or EVM_WALLET_PRIVATE_KEY environment variable " +
        "as the funding source. The new wallet is set as the active wallet for signing. " +
        "Use this before printr_launch_token to deploy tokens without exposing the treasury. " +
        "Requires PRINTR_DEPLOYMENT_PASSWORD to be set for wallet encryption.",
      inputSchema,
      outputSchema,
    },
    ({ chain, amount }) =>
      toToolResponseAsync(
        // 1. Validate keystore is writable (prevents fund loss)
        verifyKeystoreWritable()
          // 2. Validate all inputs including master password
          .andThen(() => validateInputs(chain))
          // 3. Persist wallet BEFORE funding (prevents fund loss if persistence fails)
          .andThen(({ type, treasuryKey, meta, parsed, masterPassword }) =>
            persistWallet(masterPassword, chain, type).map((wallet) => ({
              type,
              treasuryKey,
              meta,
              parsed,
              wallet,
            })),
          )
          // 4. Transfer funds only AFTER wallet is safely persisted
          .andThen(({ type, treasuryKey, meta, parsed, wallet }) =>
            executeTransfer(
              parsed.namespace,
              parsed.chainRef,
              wallet.address,
              amount,
              treasuryKey,
              meta,
            ).map((result) => {
              // 5. Set as active wallet for immediate use (in-memory)
              activeWallets.set(type, { privateKey: wallet.privateKey, address: wallet.address });
              // 6. Persist active wallet ID and deployment wallet ID for recovery (best effort)
              setActiveWalletId(type, wallet.wallet_id).mapErr((e) =>
                console.error("[state] Failed to persist active wallet ID:", e.message),
              );
              setLastDeploymentWalletId(wallet.wallet_id).mapErr((e) =>
                console.error("[state] Failed to persist deployment wallet ID:", e.message),
              );
              return {
                address: wallet.address,
                chain,
                chain_name: meta.name,
                amount_funded: amount,
                amount_atomic: result.amount_atomic,
                symbol: meta.symbol,
                ...buildTxField(result),
                wallet_id: wallet.wallet_id,
              };
            }),
          ),
      ),
  );
}
