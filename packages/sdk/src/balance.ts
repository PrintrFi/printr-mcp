import { Connection, PublicKey } from "@solana/web3.js";
import { err, errAsync, ok, type Result, ResultAsync } from "neverthrow";
import { createPublicClient, defineChain, erc20Abi, formatUnits, http } from "viem";
import type { ChainMeta } from "./chains.js";
import { getChainMeta, getRpcUrl, toCaip2 } from "./chains.js";
import { getSvmRpcUrl } from "./svm.js";

export type SimpleBalanceResult = {
  readonly balance_atomic: string;
  readonly balance_formatted: string;
  readonly symbol: string;
  readonly decimals: number;
};

export type BalanceInfo = {
  address: string;
  balance: bigint;
  balanceFormatted: string;
  symbol: string;
  sufficient: boolean;
  requiredFormatted: string;
};

export type BalanceError = "no_rpc" | "fetch_failed";

const MIN_SVM_LAMPORTS = 5_000n;
const LAMPORTS_PER_SOL = 1_000_000_000n;

export function checkEvmBalance(
  address: string,
  chainId: number,
  gasLimit: number,
  rpcUrl?: string,
): ResultAsync<BalanceInfo, BalanceError> {
  const caip2 = toCaip2("eip155", chainId);
  const meta = getChainMeta(caip2);
  const rpc = getRpcUrl(caip2, rpcUrl);
  if (!rpc) return errAsync("no_rpc" as BalanceError);

  const chain = defineChain({
    id: chainId,
    name: meta?.name ?? caip2,
    nativeCurrency: {
      name: meta?.name ?? "Ether",
      symbol: meta?.symbol ?? "ETH",
      decimals: meta?.decimals ?? 18,
    },
    rpcUrls: { default: { http: [rpc] } },
  });

  const client = createPublicClient({ chain, transport: http(rpc) });
  const decimals = meta?.decimals ?? 18;
  const symbol = meta?.symbol ?? "ETH";

  return ResultAsync.fromPromise(
    Promise.all([
      client.getBalance({ address: address as `0x${string}` }),
      client.getGasPrice(),
    ]).then(([balance, gasPrice]) => ({
      address,
      balance,
      balanceFormatted: formatUnits(balance, decimals),
      symbol,
      sufficient: balance >= gasPrice * BigInt(gasLimit),
      requiredFormatted: `~${formatUnits(gasPrice * BigInt(gasLimit), decimals)}`,
    })),
    (): BalanceError => "fetch_failed",
  );
}

export function checkSvmBalance(
  address: string,
  rpcUrl?: string,
): ResultAsync<BalanceInfo, BalanceError> {
  const rpc = getSvmRpcUrl(rpcUrl);
  const connection = new Connection(rpc, "confirmed");
  const format = (n: bigint) => `${Number(n) / Number(LAMPORTS_PER_SOL)} SOL`;

  return ResultAsync.fromPromise(
    connection.getBalance(new PublicKey(address)).then((balance) => {
      const bal = BigInt(balance);
      return {
        address,
        balance: bal,
        balanceFormatted: format(bal),
        symbol: "SOL",
        sufficient: bal >= MIN_SVM_LAMPORTS,
        requiredFormatted: format(MIN_SVM_LAMPORTS),
      };
    }),
    (): BalanceError => "fetch_failed",
  );
}

const createViemChain = (chainId: number, meta: ChainMeta, rpcUrl: string) =>
  defineChain({
    id: chainId,
    name: meta.name,
    nativeCurrency: { name: meta.name, symbol: meta.symbol, decimals: meta.decimals },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

export const resolveRpcUrl = (
  caip2: string,
  rpcOverride?: string,
): Result<string, BalanceError> => {
  if (caip2.startsWith("solana:")) return ok(getSvmRpcUrl(rpcOverride));
  const resolved = getRpcUrl(caip2, rpcOverride);
  if (resolved) return ok(resolved);
  return err("no_rpc");
};

export const getEvmNativeBalance = (
  chainId: number,
  address: `0x${string}`,
  rpcUrl: string,
  meta: ChainMeta,
): ResultAsync<SimpleBalanceResult, BalanceError> => {
  const chain = createViemChain(chainId, meta, rpcUrl);
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  return ResultAsync.fromPromise(
    client.getBalance({ address }).then((balance) => ({
      balance_atomic: balance.toString(),
      balance_formatted: formatUnits(balance, meta.decimals),
      symbol: meta.symbol,
      decimals: meta.decimals,
    })),
    (): BalanceError => "fetch_failed",
  );
};

export const getSvmNativeBalance = (
  address: string,
  rpcUrl: string,
): ResultAsync<SimpleBalanceResult, BalanceError> => {
  const connection = new Connection(rpcUrl, "confirmed");
  const pubkey = new PublicKey(address);
  return ResultAsync.fromPromise(
    connection.getBalance(pubkey).then((balance) => ({
      balance_atomic: balance.toString(),
      balance_formatted: (balance / 1e9).toFixed(9),
      symbol: "SOL",
      decimals: 9,
    })),
    (): BalanceError => "fetch_failed",
  );
};

export const getEvmTokenBalance = (
  chainId: number,
  tokenAddress: `0x${string}`,
  walletAddress: `0x${string}`,
  rpcUrl: string,
  meta: ChainMeta,
): ResultAsync<SimpleBalanceResult, BalanceError> => {
  const chain = createViemChain(chainId, meta, rpcUrl);
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  return ResultAsync.fromPromise(
    Promise.all([
      client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [walletAddress],
      }),
      client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "decimals" }),
      client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "symbol" }),
    ]).then(([balance, decimals, symbol]) => ({
      balance_atomic: balance.toString(),
      balance_formatted: formatUnits(balance, decimals),
      symbol,
      decimals,
    })),
    (): BalanceError => "fetch_failed",
  );
};

export const getSplTokenBalance = (
  mintAddress: string,
  walletAddress: string,
  rpcUrl: string,
): ResultAsync<SimpleBalanceResult, BalanceError> => {
  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = new PublicKey(walletAddress);
  const mint = new PublicKey(mintAddress);
  return ResultAsync.fromPromise(
    connection.getParsedTokenAccountsByOwner(wallet, { mint }).then((tokenAccounts) => {
      const firstAccount = tokenAccounts.value[0];
      if (!firstAccount) {
        return { balance_atomic: "0", balance_formatted: "0", symbol: "SPL", decimals: 0 };
      }
      const accountInfo = firstAccount.account.data.parsed.info;
      const balance = accountInfo.tokenAmount.amount;
      const decimals = accountInfo.tokenAmount.decimals;
      return {
        balance_atomic: balance,
        balance_formatted: (Number(balance) / 10 ** decimals).toString(),
        symbol: "SPL",
        decimals,
      };
    }),
    (): BalanceError => "fetch_failed",
  );
};

export const fetchNativeBalance = (
  namespace: string,
  chainRef: string,
  address: string,
  meta: ChainMeta,
  rpcOverride?: string,
): ResultAsync<SimpleBalanceResult, BalanceError> => {
  const caip2 = toCaip2(namespace as "eip155" | "solana", chainRef);
  const rpcResult = resolveRpcUrl(caip2, rpcOverride);
  if (rpcResult.isErr()) return errAsync(rpcResult.error);
  const rpcUrl = rpcResult.value;
  return namespace === "solana"
    ? getSvmNativeBalance(address, rpcUrl)
    : getEvmNativeBalance(Number(chainRef), address as `0x${string}`, rpcUrl, meta);
};

export const fetchTokenBalance = (
  namespace: string,
  chainRef: string,
  tokenAddress: string,
  walletAddress: string,
  meta: ChainMeta,
  rpcOverride?: string,
): ResultAsync<SimpleBalanceResult, BalanceError> => {
  const caip2 = toCaip2(namespace as "eip155" | "solana", chainRef);
  const rpcResult = resolveRpcUrl(caip2, rpcOverride);
  if (rpcResult.isErr()) return errAsync(rpcResult.error);
  const rpcUrl = rpcResult.value;
  return namespace === "solana"
    ? getSplTokenBalance(tokenAddress, walletAddress, rpcUrl)
    : getEvmTokenBalance(
        Number(chainRef),
        tokenAddress as `0x${string}`,
        walletAddress as `0x${string}`,
        rpcUrl,
        meta,
      );
};
