import { randomUUID } from "node:crypto";

export type WalletAction = "unlock" | "provide" | "new";

export type WalletSessionResult =
  | { status: "success"; address: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export type WalletSession = {
  token: string;
  action: WalletAction;
  /** CAIP-2 chain ID */
  chain: string;
  /** For "unlock": the keystore wallet ID to decrypt */
  walletId?: string;
  /** For "new": the generated address (shown in browser) */
  address?: string;
  /** For "new": the generated private key (shown once in browser, never written to disk) */
  privateKeyTemp?: string;
  created_at: number;
  expires_at: number;
  result?: WalletSessionResult;
};

/** Resolved, decrypted wallets ready for signing — keyed by chain type */
export type ChainType = "evm" | "svm";

export type ActiveWallet = {
  privateKey: string;
  address: string;
};

export const walletSessions = new Map<string, WalletSession>();

/** In-memory active wallets — cleared on process restart */
export const activeWallets = new Map<ChainType, ActiveWallet>();

const SESSION_TTL_MS = 30 * 60 * 1000;

export function createWalletSession(
  input: Omit<WalletSession, "token" | "created_at" | "expires_at" | "result">,
): WalletSession {
  const token = randomUUID();
  const now = Date.now();
  const session: WalletSession = {
    ...input,
    token,
    created_at: now,
    expires_at: now + SESSION_TTL_MS,
  };
  walletSessions.set(token, session);
  return session;
}

export function getWalletSession(token: string): WalletSession | undefined {
  const session = walletSessions.get(token);
  if (!session) return undefined;
  if (Date.now() > session.expires_at) {
    walletSessions.delete(token);
    return undefined;
  }
  return session;
}

export function setWalletSessionResult(token: string, result: WalletSessionResult): boolean {
  const session = getWalletSession(token);
  if (!session) return false;
  // Clear the temp private key once the browser has confirmed
  const { privateKeyTemp: _, ...rest } = session;
  walletSessions.set(token, { ...rest, result });
  return true;
}
