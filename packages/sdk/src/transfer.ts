import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { errAsync, ResultAsync } from "neverthrow";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { ChainMeta } from "./chains.js";
import { getRpcUrl } from "./chains.js";
import { normalisePrivateKey } from "./evm.js";
import { getSvmRpcUrl, sendAndConfirmSvmTransaction } from "./svm.js";

export type TransferError = { message: string };

export type EvmTransferResult = {
  readonly type: "evm";
  readonly tx_hash: string;
  readonly amount_atomic: string;
};

export type SvmTransferResult = {
  readonly type: "svm";
  readonly signature: string;
  readonly amount_atomic: string;
};

export type TransferResult = EvmTransferResult | SvmTransferResult;

const createViemChain = (chainId: number, meta: ChainMeta, rpcUrl: string) =>
  defineChain({
    id: chainId,
    name: meta.name,
    nativeCurrency: { name: meta.name, symbol: meta.symbol, decimals: meta.decimals },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

export const transferEvm = async (
  chainId: number,
  toAddress: `0x${string}`,
  amount: bigint,
  privateKey: string,
  rpcUrl: string,
  meta: ChainMeta,
): Promise<EvmTransferResult> => {
  const chain = createViemChain(chainId, meta, rpcUrl);
  const account = privateKeyToAccount(normalisePrivateKey(privateKey));
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  const hash = await walletClient.sendTransaction({ to: toAddress, value: amount });

  return { type: "evm", tx_hash: hash, amount_atomic: amount.toString() };
};

export const transferSvm = async (
  toAddress: string,
  lamports: bigint,
  privateKey: string,
  rpcUrl: string,
): Promise<SvmTransferResult> => {
  const connection = new Connection(rpcUrl, "confirmed");
  const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  const toPubkey = new PublicKey(toAddress);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey,
      lamports,
    }),
  );

  const signature = await sendAndConfirmSvmTransaction(connection, transaction, [keypair]);

  return { type: "svm", signature, amount_atomic: lamports.toString() };
};

const toTransferError = (e: unknown): TransferError => ({
  message: e instanceof Error ? e.message : String(e),
});

export const executeTransfer = (
  namespace: string,
  chainRef: string,
  toAddress: string,
  amount: string,
  privateKey: string,
  meta: ChainMeta,
  rpcOverride?: string,
): ResultAsync<TransferResult, TransferError> => {
  const caip2 = namespace === "solana" ? `solana:${chainRef}` : `eip155:${chainRef}`;

  if (namespace === "solana") {
    const rpc = getSvmRpcUrl(rpcOverride);
    const lamports = BigInt(Math.floor(Number.parseFloat(amount) * LAMPORTS_PER_SOL));
    return ResultAsync.fromPromise(
      transferSvm(toAddress, lamports, privateKey, rpc),
      toTransferError,
    );
  }

  const rpc = getRpcUrl(caip2, rpcOverride);
  if (!rpc) {
    return errAsync({
      message: `No RPC URL for chain ${caip2}. Pass rpc_url explicitly or set RPC_URLS.`,
    });
  }

  const amountAtomic = parseUnits(amount, meta.decimals);
  return ResultAsync.fromPromise(
    transferEvm(Number(chainRef), toAddress as `0x${string}`, amountAtomic, privateKey, rpc, meta),
    toTransferError,
  );
};

/**
 * Transfer an ERC20 token on an EVM chain.
 *
 * Calls the standard `transfer(address,uint256)` method on the token contract.
 * The caller is responsible for ensuring `amount` is in the token's atomic units
 * (use {@link executeTokenTransfer} for human-readable amounts with auto-detected decimals).
 *
 * @param chainId - EVM chain ID (e.g. `8453` for Base)
 * @param toAddress - Recipient EVM address
 * @param tokenAddress - ERC20 contract address
 * @param amount - Transfer amount in atomic units
 * @param privateKey - Sender private key (hex, with or without `0x` prefix)
 * @param rpcUrl - JSON-RPC endpoint URL
 * @param meta - Chain metadata (used for viem chain definition)
 * @returns Transaction hash and the amount sent
 * @throws If the RPC call fails or the contract reverts
 */
export const transferErc20 = async (
  chainId: number,
  toAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
  amount: bigint,
  privateKey: string,
  rpcUrl: string,
  meta: ChainMeta,
): Promise<EvmTransferResult> => {
  const chain = createViemChain(chainId, meta, rpcUrl);
  const account = privateKeyToAccount(normalisePrivateKey(privateKey));
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "transfer",
    args: [toAddress, amount],
  });

  return { type: "evm", tx_hash: hash, amount_atomic: amount.toString() };
};

/**
 * Transfer an SPL token on Solana.
 *
 * Auto-detects the token program (SPL classic or Token-2022) from the mint account
 * owner, fetches the mint's decimals, and creates the recipient's associated token
 * account on demand if it does not yet exist (the sender pays the rent).
 *
 * The caller is responsible for ensuring `amount` is in the token's atomic units
 * (use {@link executeTokenTransfer} for human-readable amounts with auto-detected decimals).
 *
 * @param toAddress - Recipient Solana address (the wallet, not the ATA)
 * @param mintAddress - SPL token mint address
 * @param amount - Transfer amount in atomic units (smallest unit, per mint decimals)
 * @param privateKey - Sender keypair as a base58-encoded secret key
 * @param rpcUrl - Solana JSON-RPC endpoint URL
 * @returns Transaction signature and the amount sent
 * @throws If the mint is not found, the RPC fails, or the transaction errors
 */
export const transferSplToken = async (
  toAddress: string,
  mintAddress: string,
  amount: bigint,
  privateKey: string,
  rpcUrl: string,
): Promise<SvmTransferResult> => {
  const connection = new Connection(rpcUrl, "confirmed");
  const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  const mint = new PublicKey(mintAddress);
  const recipient = new PublicKey(toAddress);

  const mintAccount = await connection.getAccountInfo(mint);
  if (!mintAccount) {
    throw new Error(`Mint not found: ${mintAddress}`);
  }
  const programId = mintAccount.owner;

  const mintInfo = await getMint(connection, mint, undefined, programId);
  const decimals = mintInfo.decimals;

  const sourceAta = await getAssociatedTokenAddress(mint, keypair.publicKey, false, programId);
  const destAta = await getAssociatedTokenAddress(mint, recipient, false, programId);

  const transaction = new Transaction();

  const destInfo = await connection.getAccountInfo(destAta);
  if (!destInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        keypair.publicKey,
        destAta,
        recipient,
        mint,
        programId,
      ),
    );
  }

  transaction.add(
    createTransferCheckedInstruction(
      sourceAta,
      mint,
      destAta,
      keypair.publicKey,
      amount,
      decimals,
      [],
      programId,
    ),
  );

  const signature = await sendAndConfirmSvmTransaction(connection, transaction, [keypair]);

  return { type: "svm", signature, amount_atomic: amount.toString() };
};

const fetchErc20Decimals = async (
  chainId: number,
  tokenAddress: `0x${string}`,
  rpcUrl: string,
  meta: ChainMeta,
): Promise<number> => {
  const chain = createViemChain(chainId, meta, rpcUrl);
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  return client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
  });
};

const fetchSplDecimals = async (mintAddress: string, rpcUrl: string): Promise<number> => {
  const connection = new Connection(rpcUrl, "confirmed");
  const mint = new PublicKey(mintAddress);
  const mintAccount = await connection.getAccountInfo(mint);
  if (!mintAccount) {
    throw new Error(`Mint not found: ${mintAddress}`);
  }
  const mintInfo = await getMint(connection, mint, undefined, mintAccount.owner);
  return mintInfo.decimals;
};

/**
 * Dispatch a fungible-token transfer to the appropriate chain implementation.
 *
 * Mirrors {@link executeTransfer} but for ERC20 / SPL tokens instead of native coins.
 * Token decimals are auto-detected from the contract (`decimals()`) on EVM, or from
 * the mint account on Solana, and the human-readable `amount` is parsed against them.
 *
 * @param namespace - CAIP-2 namespace: `"eip155"` or `"solana"`
 * @param chainRef - Chain reference: numeric chain ID for EVM, base58 genesis hash for Solana
 * @param toAddress - Recipient address (raw, not CAIP-10)
 * @param tokenAddress - ERC20 contract address or SPL mint address
 * @param amount - Human-readable amount (e.g. `"1.5"` for 1.5 USDC)
 * @param privateKey - Sender private key (hex for EVM, base58 secret key for Solana)
 * @param meta - Chain metadata for the destination chain
 * @param rpcOverride - Optional RPC endpoint override
 * @returns Result with the transfer outcome ({@link TransferResult}) or a {@link TransferError}
 */
export const executeTokenTransfer = (
  namespace: string,
  chainRef: string,
  toAddress: string,
  tokenAddress: string,
  amount: string,
  privateKey: string,
  meta: ChainMeta,
  rpcOverride?: string,
): ResultAsync<TransferResult, TransferError> => {
  if (namespace === "solana") {
    const rpc = getSvmRpcUrl(rpcOverride);
    return ResultAsync.fromPromise(fetchSplDecimals(tokenAddress, rpc), toTransferError).andThen(
      (decimals) =>
        ResultAsync.fromPromise(
          transferSplToken(toAddress, tokenAddress, parseUnits(amount, decimals), privateKey, rpc),
          toTransferError,
        ),
    );
  }

  const caip2 = `eip155:${chainRef}`;
  const rpc = getRpcUrl(caip2, rpcOverride);
  if (!rpc) {
    return errAsync({
      message: `No RPC URL for chain ${caip2}. Pass rpc_url explicitly or set RPC_URLS.`,
    });
  }

  return ResultAsync.fromPromise(
    fetchErc20Decimals(Number(chainRef), tokenAddress as `0x${string}`, rpc, meta),
    toTransferError,
  ).andThen((decimals) =>
    ResultAsync.fromPromise(
      transferErc20(
        Number(chainRef),
        toAddress as `0x${string}`,
        tokenAddress as `0x${string}`,
        parseUnits(amount, decimals),
        privateKey,
        rpc,
        meta,
      ),
      toTransferError,
    ),
  );
};
