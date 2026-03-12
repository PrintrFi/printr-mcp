import { randomBytes, randomUUID } from "node:crypto";
import { accessSync, constants } from "node:fs";
import { dirname } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { err, errAsync, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { type ChainType, chainTypeFromCaip2, parseCaip2 } from "~/lib/caip.js";
import { getChainMeta } from "~/lib/chains.js";
import { toToolResponseAsync } from "~/lib/client.js";
import { normalisePrivateKey } from "~/lib/evm.js";
import { addWallet, encryptKey, keystorePath } from "~/lib/keystore.js";
import { executeTransfer } from "~/lib/transfer.js";
import { getTreasuryErrorMsg, getTreasuryKey } from "~/lib/treasury.js";
import { activeWallets } from "~/server/wallet-sessions.js";

type FundError = { message: string };

function generateSecurePassword(): string {
  return randomBytes(32).toString("base64url");
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
  generated_password?: string;
  privateKey: string;
  address: string;
};

function persistWallet(
  label: string | undefined,
  password: string | undefined,
  chain: string,
  type: ChainType,
): Result<PersistedWallet, FundError> {
  const { privateKey, address } = generateWallet(type);
  const effectiveLabel = label ?? `deploy-${address.slice(0, 8)}`;
  const generatedPassword = password ? undefined : generateSecurePassword();
  const effectivePassword = password ?? generatedPassword!;

  try {
    const wallet_id = saveToKeystore(effectiveLabel, effectivePassword, chain, address, privateKey);
    return ok({ wallet_id, generated_password: generatedPassword, privateKey, address });
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
  wallet_id: z.string().describe("Keystore wallet ID for the persisted wallet"),
  generated_password: z
    .string()
    .optional()
    .describe("Auto-generated password (only returned if no password was provided - save this!)"),
});

function validateInputs(chain: string): Result<
  {
    type: ChainType;
    treasuryKey: string;
    meta: NonNullable<ReturnType<typeof getChainMeta>>;
    parsed: NonNullable<ReturnType<typeof parseCaip2>>;
  },
  FundError
> {
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

  return ok({ type, treasuryKey, meta, parsed });
}

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
    ({ chain, amount, label, password }) =>
      toToolResponseAsync(
        // 1. Validate keystore is writable (prevents fund loss)
        verifyKeystoreWritable()
          // 2. Validate all inputs
          .andThen(() => validateInputs(chain))
          // 3. Persist wallet BEFORE funding (prevents fund loss if persistence fails)
          .andThen(({ type, treasuryKey, meta, parsed }) =>
            persistWallet(label, password, chain, type).map((wallet) => ({
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
              // 5. Set as active wallet for immediate use
              activeWallets.set(type, { privateKey: wallet.privateKey, address: wallet.address });
              return {
                address: wallet.address,
                chain,
                chain_name: meta.name,
                amount_funded: amount,
                amount_atomic: result.amount_atomic,
                symbol: meta.symbol,
                ...buildTxField(result),
                wallet_id: wallet.wallet_id,
                ...(wallet.generated_password
                  ? { generated_password: wallet.generated_password }
                  : {}),
              };
            }),
          ),
      ),
  );
}
