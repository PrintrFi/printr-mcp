export type ChainType = "evm" | "svm";

export type TokenMeta = {
  name: string;
  symbol: string;
  description?: string | undefined;
  image_url?: string | undefined;
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
  token_meta?: TokenMeta | undefined;
  rpc_url?: string | undefined;
  created_at: number;
  expires_at: number;
  result?: TxResult;
};

export type CreateSessionInput = Omit<TxSession, "token" | "created_at" | "expires_at" | "result">;

/** Signing sessions live for 30 minutes, matching the local stdio server. */
export const SESSION_TTL_MS = 30 * 60 * 1000;
