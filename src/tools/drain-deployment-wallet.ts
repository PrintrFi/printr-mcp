import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { type ChainType, chainTypeFromCaip2, parseCaip2 } from "~/lib/caip.js";
import type { ChainMeta } from "~/lib/chains.js";
import { getChainMeta, getRpcUrl } from "~/lib/chains.js";
import { toolError, toolOk } from "~/lib/client.js";
import { normalisePrivateKey } from "~/lib/evm.js";
import { getSvmRpcUrl, sendAndConfirmSvmTransaction } from "~/lib/svm.js";
import { getTreasuryKeyOrError } from "~/lib/treasury.js";
import { activeWallets } from "~/server/wallet-sessions.js";

type ActiveWalletResult = { error: string } | { wallet: { privateKey: string; address: string } };

function getActiveWalletOrError(type: ChainType): ActiveWalletResult {
  const wallet = activeWallets.get(type);
  if (!wallet) {
    return {
      error: `No active ${type.toUpperCase()} deployment wallet. Call printr_fund_deployment_wallet first.`,
    };
  }
  return { wallet };
}

type EvmConfigResult = { error: string } | { chainId: number; rpc: string };

function getEvmConfigOrError(chain: string): EvmConfigResult {
  const parsed = parseCaip2(chain);
  if (!parsed)
    return { error: `Invalid CAIP-2 chain format: ${chain}. Expected 'namespace:chainRef'.` };

  const rpc = getRpcUrl(chain);
  if (!rpc) return { error: `No RPC URL for chain ${chain}. Set RPC_URLS or ALCHEMY_API_KEY.` };

  return { chainId: Number(parsed.chainRef), rpc };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatAmount(atomic: bigint, decimals: number): string {
  return (Number(atomic) / 10 ** decimals).toString();
}

function buildDrainResult(
  drainedAtomic: bigint,
  meta: ChainMeta,
  fromAddress: string,
  toAddress: string,
  remainingAtomic: bigint,
  tx?: { type: "svm"; signature: string } | { type: "evm"; hash: string },
) {
  return {
    drained_amount: formatAmount(drainedAtomic, meta.decimals),
    drained_atomic: drainedAtomic.toString(),
    symbol: meta.symbol,
    from_address: fromAddress,
    to_address: toAddress,
    ...(tx?.type === "svm" ? { tx_signature: tx.signature } : {}),
    ...(tx?.type === "evm" ? { tx_hash: tx.hash } : {}),
    remaining_balance: formatAmount(remainingAtomic, meta.decimals),
  };
}

async function drainSvm(
  activeWallet: { privateKey: string; address: string },
  treasuryKey: string,
  keepMinimum: number,
  meta: ChainMeta,
) {
  const rpc = getSvmRpcUrl();
  const connection = new Connection(rpc, "confirmed");
  const deploymentKeypair = Keypair.fromSecretKey(bs58.decode(activeWallet.privateKey));
  const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(treasuryKey));
  const treasuryAddress = treasuryKeypair.publicKey.toBase58();

  const balance = await connection.getBalance(deploymentKeypair.publicKey);
  const balanceLamports = BigInt(balance);

  // Use 5000 lamports as base fee estimate with safety buffer
  const estimatedFee = 10000n;
  const keepMinimumLamports = BigInt(Math.floor(keepMinimum * LAMPORTS_PER_SOL));
  const drainAmount = balanceLamports - estimatedFee - keepMinimumLamports;

  if (drainAmount <= 0n) {
    return {
      result: buildDrainResult(0n, meta, activeWallet.address, treasuryAddress, balanceLamports),
    };
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: deploymentKeypair.publicKey,
      toPubkey: new PublicKey(treasuryAddress),
      lamports: drainAmount,
    }),
  );

  const signature = await sendAndConfirmSvmTransaction(connection, transaction, [
    deploymentKeypair,
  ]);
  const finalBalance = await connection.getBalance(deploymentKeypair.publicKey);

  activeWallets.delete("svm");

  return {
    result: buildDrainResult(
      drainAmount,
      meta,
      activeWallet.address,
      treasuryAddress,
      BigInt(finalBalance),
      { type: "svm", signature },
    ),
  };
}

async function drainEvm(
  activeWallet: { privateKey: string; address: string },
  treasuryKey: string,
  keepMinimum: string,
  meta: ChainMeta,
  chainId: number,
  rpc: string,
) {
  const deploymentAccount = privateKeyToAccount(normalisePrivateKey(activeWallet.privateKey));
  const treasuryAccount = privateKeyToAccount(normalisePrivateKey(treasuryKey));

  const publicClient = createPublicClient({ transport: http(rpc) });
  const walletClient = createWalletClient({ account: deploymentAccount, transport: http(rpc) });

  const balance = await publicClient.getBalance({ address: deploymentAccount.address });
  const gasPrice = await publicClient.getGasPrice();
  const gasLimit = 21000n;
  const gasCost = gasPrice * gasLimit;
  const keepMinimumWei = parseUnits(keepMinimum, meta.decimals);
  const drainAmount = balance - gasCost - keepMinimumWei;

  if (drainAmount <= 0n) {
    return {
      result: buildDrainResult(0n, meta, activeWallet.address, treasuryAccount.address, balance),
    };
  }

  const hash = await walletClient.sendTransaction({
    to: treasuryAccount.address,
    value: drainAmount,
    chain: {
      id: chainId,
      name: meta.name,
      nativeCurrency: { name: meta.name, symbol: meta.symbol, decimals: meta.decimals },
      rpcUrls: { default: { http: [rpc] } },
    },
  });

  const finalBalance = await publicClient.getBalance({ address: deploymentAccount.address });

  activeWallets.delete("evm");

  return {
    result: buildDrainResult(
      drainAmount,
      meta,
      activeWallet.address,
      treasuryAccount.address,
      finalBalance,
      { type: "evm", hash },
    ),
  };
}

const inputSchema = z.object({
  chain: z
    .string()
    .describe(
      "CAIP-2 chain ID (e.g. 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' for Solana mainnet)",
    ),
  keep_minimum: z
    .string()
    .optional()
    .default("0")
    .describe("Minimum amount to keep in the wallet (default: 0, drain everything possible)"),
});

const outputSchema = z.object({
  drained_amount: z.string().describe("Amount drained in human-readable units"),
  drained_atomic: z.string().describe("Amount drained in atomic units (lamports/wei)"),
  symbol: z.string().describe("Native token symbol"),
  from_address: z.string().describe("Deployment wallet address that was drained"),
  to_address: z.string().describe("Treasury wallet address that received funds"),
  tx_signature: z.string().optional().describe("Solana transaction signature"),
  tx_hash: z.string().optional().describe("EVM transaction hash"),
  remaining_balance: z.string().describe("Remaining balance in the deployment wallet"),
});

export function registerDrainDeploymentWalletTool(server: McpServer): void {
  server.registerTool(
    "printr_drain_deployment_wallet",
    {
      description:
        "Drain remaining funds from the active deployment wallet back to the treasury. " +
        "Use this after printr_launch_token to recover unused gas funds. " +
        "Automatically calculates gas fees and drains the maximum possible amount.",
      inputSchema,
      outputSchema,
    },
    async ({ chain, keep_minimum }) => {
      try {
        const type = chainTypeFromCaip2(chain);

        const walletResult = getActiveWalletOrError(type);
        if ("error" in walletResult) return toolError(walletResult.error);

        const treasuryResult = getTreasuryKeyOrError(type);
        if ("error" in treasuryResult) return toolError(treasuryResult.error);

        const meta = getChainMeta(chain);
        if (!meta) return toolError(`Unsupported chain: ${chain}`);

        const keepMin = keep_minimum ?? "0";

        if (type === "svm") {
          const { result } = await drainSvm(
            walletResult.wallet,
            treasuryResult.key,
            parseFloat(keepMin),
            meta,
          );
          return toolOk(result);
        }

        const evmConfig = getEvmConfigOrError(chain);
        if ("error" in evmConfig) return toolError(evmConfig.error);

        const { result } = await drainEvm(
          walletResult.wallet,
          treasuryResult.key,
          keepMin,
          meta,
          evmConfig.chainId,
          evmConfig.rpc,
        );
        return toolOk(result);
      } catch (error) {
        return toolError(formatError(error));
      }
    },
  );
}
