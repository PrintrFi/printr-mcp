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
import { createWalletClient, defineChain, http, parseUnits } from "viem";
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
