import { randomUUID } from "node:crypto";

export type ChainType = "evm" | "svm";

export type TokenMeta = {
  name: string;
  symbol: string;
  description?: string;
  image_url?: string;
};

export type TxResult = {
  status: "success" | "failed";
  tx_hash?: string;
  signature?: string;
  error?: string;
  /** Base64-encoded replacement image, set when the user updates the token image in the web signer. */
  image_data?: string;
};

export type TxSession = {
  token: string;
  chain_type: ChainType;
  payload: unknown;
  token_id: string;
  token_meta?: TokenMeta;
  rpc_url?: string;
  created_at: number;
  expires_at: number;
  result?: TxResult;
};

export type CreateSessionInput = Omit<TxSession, "token" | "created_at" | "expires_at" | "result">;

const SESSION_TTL_MS = 30 * 60 * 1000;

export const sessions = new Map<string, TxSession>();

/**
 * Creates an ephemeral signing session and stores it in memory.
 * The session expires after 30 minutes.
 */
export function createSession(input: CreateSessionInput): TxSession {
  const token = randomUUID();
  const now = Date.now();
  const session: TxSession = { ...input, token, created_at: now, expires_at: now + SESSION_TTL_MS };
  sessions.set(token, session);
  return session;
}

/**
 * Retrieves a session by token.
 * Returns `undefined` if the token is unknown or the session has expired.
 * Expired sessions are evicted on read.
 */
export function getSession(token: string): TxSession | undefined {
  const session = sessions.get(token);
  if (!session) return undefined;
  if (Date.now() > session.expires_at) {
    sessions.delete(token);
    return undefined;
  }
  return session;
}

/** Updates a session with a signing result. Returns `false` if the session is not found or expired. */
export function setResult(token: string, result: TxResult): boolean {
  const session = getSession(token);
  if (!session) return false;
  sessions.set(token, { ...session, result });
  return true;
}
