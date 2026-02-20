import { Connection, PublicKey } from "@solana/web3.js";
import { err, ok, type Result } from "neverthrow";
import { createPublicClient, defineChain, formatUnits, http } from "viem";
import { getChainMeta } from "~/lib/chains.js";
import { DEFAULT_SVM_RPC } from "~/lib/svm.js";

export type BalanceInfo = {
  address: string;
  balance: bigint;
  balanceFormatted: string;
  symbol: string;
  sufficient: boolean;
  /** Human-readable minimum required (for error messages) */
  requiredFormatted: string;
};

export type BalanceError = "no_rpc" | "fetch_failed";

/** Minimum lamports required for an SVM transaction fee */
const MIN_SVM_LAMPORTS = 5_000n;
const LAMPORTS_PER_SOL = 1_000_000_000n;

export async function checkEvmBalance(
  address: string,
  chainId: number,
  gasLimit: number,
  rpcUrl?: string,
): Promise<Result<BalanceInfo, BalanceError>> {
  const caip2 = `eip155:${chainId}`;
  const meta = getChainMeta(caip2);
  const rpc = rpcUrl ?? meta?.defaultRpc;
  if (!rpc) return err("no_rpc");

  try {
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
    const [balance, gasPrice] = await Promise.all([
      client.getBalance({ address: address as `0x${string}` }),
      client.getGasPrice(),
    ]);

    const required = gasPrice * BigInt(gasLimit);
    const decimals = meta?.decimals ?? 18;
    const symbol = meta?.symbol ?? "ETH";

    return ok({
      address,
      balance,
      balanceFormatted: formatUnits(balance, decimals),
      symbol,
      sufficient: balance >= required,
      requiredFormatted: `~${formatUnits(required, decimals)}`,
    });
  } catch {
    return err("fetch_failed");
  }
}

export async function checkSvmBalance(
  address: string,
  rpcUrl?: string,
): Promise<Result<BalanceInfo, BalanceError>> {
  const rpc = rpcUrl ?? DEFAULT_SVM_RPC;
  try {
    const connection = new Connection(rpc, "confirmed");
    const balance = BigInt(await connection.getBalance(new PublicKey(address)));
    const format = (n: bigint) => `${Number(n) / Number(LAMPORTS_PER_SOL)} SOL`;

    return ok({
      address,
      balance,
      balanceFormatted: format(balance),
      symbol: "SOL",
      sufficient: balance >= MIN_SVM_LAMPORTS,
      requiredFormatted: format(MIN_SVM_LAMPORTS),
    });
  } catch {
    return err("fetch_failed");
  }
}
