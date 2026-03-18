import type { ChainType } from "@printr/sdk";

export type { ChainType };

export type ActiveWallet = {
  privateKey: string;
  address: string;
};

/** In-memory active wallets — cleared on process restart */
export const activeWallets = new Map<ChainType, ActiveWallet>();

/** In-memory treasury wallets — used by fund/drain deployment wallet tools */
export const treasuryWallets = new Map<ChainType, ActiveWallet>();
