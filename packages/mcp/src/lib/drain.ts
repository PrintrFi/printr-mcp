import {
  type ChainMeta,
  clearActiveWalletId,
  clearLastDeploymentWalletId,
  getSvmRpcUrl,
  logger,
  normalisePrivateKey,
  sendAndConfirmSvmTransaction,
} from "@printr/sdk";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { okAsync, ResultAsync } from "neverthrow";
import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { activeWallets } from "~/server/wallet-sessions.js";

export type DrainError = { message: string };

export type ResolvedWallet = { privateKey: string; address: string; walletId: string };

function formatAmount(atomic: bigint, decimals: number): string {
  return (Number(atomic) / 10 ** decimals).toString();
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildDrainResult(
  drainedAtomic: bigint,
  meta: ChainMeta,
  fromAddress: string,
  toAddress: string,
  remainingAtomic: bigint,
  walletId: string,
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
    wallet_id: walletId,
  };
}

export type DrainResult = ReturnType<typeof buildDrainResult>;

// Minimum rent-exempt balance for a basic account (0 data bytes)
// This is approximately 890,880 lamports (~0.00089 SOL)
const RENT_EXEMPT_MINIMUM = 890_880n;

export function drainSvm(
  wallet: ResolvedWallet,
  treasuryKey: string,
  keepMinimum: number,
  meta: ChainMeta,
  rpcUrl?: string,
): ResultAsync<DrainResult, DrainError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rpc = rpcUrl ?? getSvmRpcUrl();
      const connection = new Connection(rpc, "confirmed");
      const deploymentKeypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
      const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(treasuryKey));
      const treasuryAddress = treasuryKeypair.publicKey.toBase58();

      const balance = await connection.getBalance(deploymentKeypair.publicKey);
      const balanceLamports = BigInt(balance);

      // Use 5000 lamports as base fee estimate with safety buffer
      const estimatedFee = 10000n;
      const keepMinimumLamports = BigInt(Math.floor(keepMinimum * LAMPORTS_PER_SOL));

      // Must keep rent-exempt minimum to avoid "insufficient funds for rent" error
      // The account needs to either stay rent-exempt or be closed entirely
      const mustKeep = estimatedFee + keepMinimumLamports + RENT_EXEMPT_MINIMUM;
      const drainAmount = balanceLamports > mustKeep ? balanceLamports - mustKeep : 0n;

      if (drainAmount <= 0n) {
        return buildDrainResult(
          0n,
          meta,
          wallet.address,
          treasuryAddress,
          balanceLamports,
          wallet.walletId,
        );
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

      // Clear state after successful drain — only if this wallet is the tracked active one
      if (activeWallets.get("svm")?.address === wallet.address) {
        activeWallets.delete("svm");
        clearActiveWalletId("svm").mapErr((e) =>
          logger.warn({ error: e.message }, "Failed to clear active wallet ID"),
        );
        clearLastDeploymentWalletId().mapErr((e) =>
          logger.warn({ error: e.message }, "Failed to clear deployment wallet ID"),
        );
      }

      return buildDrainResult(
        drainAmount,
        meta,
        wallet.address,
        treasuryAddress,
        BigInt(finalBalance),
        wallet.walletId,
        { type: "svm", signature },
      );
    })(),
    (e): DrainError => ({ message: formatError(e) }),
  );
}

export function drainEvm(
  wallet: ResolvedWallet,
  treasuryKey: string,
  keepMinimum: string,
  meta: ChainMeta,
  chainId: number,
  rpc: string,
): ResultAsync<DrainResult, DrainError> {
  const deploymentAccount = privateKeyToAccount(normalisePrivateKey(wallet.privateKey));
  const treasuryAccount = privateKeyToAccount(normalisePrivateKey(treasuryKey));
  const publicClient = createPublicClient({ transport: http(rpc) });
  const walletClient = createWalletClient({ account: deploymentAccount, transport: http(rpc) });
  const keepMinimumWei = parseUnits(keepMinimum, meta.decimals);
  const gasLimit = 21000n;
  const toErr = (e: unknown): DrainError => ({ message: formatError(e) });

  return ResultAsync.fromPromise(
    Promise.all([
      publicClient.getBalance({ address: deploymentAccount.address }),
      publicClient.getGasPrice(),
    ]),
    toErr,
  ).andThen(([balance, gasPrice]) => {
    const drainAmount = balance - gasPrice * gasLimit - keepMinimumWei;

    if (drainAmount <= 0n) {
      return okAsync(
        buildDrainResult(
          0n,
          meta,
          wallet.address,
          treasuryAccount.address,
          balance,
          wallet.walletId,
        ),
      );
    }

    return ResultAsync.fromPromise(
      walletClient.sendTransaction({
        to: treasuryAccount.address,
        value: drainAmount,
        chain: {
          id: chainId,
          name: meta.name,
          nativeCurrency: { name: meta.name, symbol: meta.symbol, decimals: meta.decimals },
          rpcUrls: { default: { http: [rpc] } },
        },
      }),
      toErr,
    ).andThen((hash) =>
      ResultAsync.fromPromise(
        publicClient.getBalance({ address: deploymentAccount.address }),
        toErr,
      ).map((finalBalance) => {
        // Clear state after successful drain — only if this wallet is the tracked active one
        if (activeWallets.get("evm")?.address === wallet.address) {
          activeWallets.delete("evm");
          clearActiveWalletId("evm").mapErr((e) =>
            logger.warn({ error: e.message }, "Failed to clear active wallet ID"),
          );
          clearLastDeploymentWalletId().mapErr((e) =>
            logger.warn({ error: e.message }, "Failed to clear deployment wallet ID"),
          );
        }
        return buildDrainResult(
          drainAmount,
          meta,
          wallet.address,
          treasuryAccount.address,
          finalBalance,
          wallet.walletId,
          { type: "evm", hash },
        );
      }),
    );
  });
}
