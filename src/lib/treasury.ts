import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { privateKeyToAccount } from "viem/accounts";
import type { ChainType } from "~/lib/caip.js";
import { env } from "~/lib/env.js";
import { normalisePrivateKey } from "~/lib/evm.js";
import { treasuryWallets } from "~/server/wallet-sessions.js";

/**
 * Get treasury private key - checks session wallet first, then env var fallback.
 */
export function getTreasuryKey(type: ChainType): string | undefined {
  const sessionTreasury = treasuryWallets.get(type);
  if (sessionTreasury) return sessionTreasury.privateKey;
  return type === "svm" ? env.SVM_WALLET_PRIVATE_KEY : env.EVM_WALLET_PRIVATE_KEY;
}

/**
 * Get error message for missing treasury wallet.
 */
export function getTreasuryErrorMsg(type: ChainType): string {
  const envVar = type === "svm" ? "SVM" : "EVM";
  return `Treasury wallet not configured. Use printr_set_treasury_wallet or set ${envVar}_WALLET_PRIVATE_KEY environment variable.`;
}

/**
 * Get treasury key or return error object.
 */
export function getTreasuryKeyOrError(type: ChainType): { error: string } | { key: string } {
  const key = getTreasuryKey(type);
  if (!key) return { error: getTreasuryErrorMsg(type) };
  return { key };
}

/**
 * Get treasury public address from private key.
 */
export function getTreasuryAddress(type: ChainType): string | undefined {
  const key = getTreasuryKey(type);
  if (!key) return undefined;

  if (type === "svm") {
    const keypair = Keypair.fromSecretKey(bs58.decode(key));
    return keypair.publicKey.toBase58();
  }

  const account = privateKeyToAccount(normalisePrivateKey(key));
  return account.address;
}
