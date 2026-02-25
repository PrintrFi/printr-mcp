/** Chain type discriminator */
export type ChainType = "evm" | "svm";

export type ActiveWallet = {
  privateKey: string;
  address: string;
};

/** In-memory active wallets — cleared on process restart */
export const activeWallets = new Map<ChainType, ActiveWallet>();
