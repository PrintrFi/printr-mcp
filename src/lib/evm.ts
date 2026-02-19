import {
  type Address,
  createPublicClient,
  createWalletClient,
  defineChain,
  type Hex,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

/** Parse chain ID and address from a CAIP-10 string (e.g. "eip155:8453:0x...") */
export function parseEvmCaip10(caip10: string): { chainId: number; address: Address } {
  const parts = caip10.split(":");
  if (parts.length < 3) {
    throw new Error(`Invalid CAIP-10 address: ${caip10}`);
  }
  const chainId = Number(parts[1]);
  const address = parts.slice(2).join(":") as Address;
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(`Invalid chain ID in CAIP-10: ${caip10}`);
  }
  return { chainId, address };
}

/** Normalise a hex private key to have a 0x prefix */
export function normalisePrivateKey(key: string): Hex {
  return key.startsWith("0x") ? (key as Hex) : `0x${key}`;
}

export type EvmPayload = {
  to: string;
  calldata: string;
  value: string;
  gas_limit: number;
};

export type EvmSubmitResult = {
  tx_hash: string;
  block_number: string;
  status: "success" | "reverted";
};

export async function signAndSubmitEvm(
  payload: EvmPayload,
  privateKey: string,
  rpcUrl: string,
): Promise<EvmSubmitResult> {
  const { chainId, address: toAddress } = parseEvmCaip10(payload.to);

  const chain = defineChain({
    id: chainId,
    name: `eip155:${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

  const account = privateKeyToAccount(normalisePrivateKey(privateKey));

  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  const hash = await walletClient.sendTransaction({
    to: toAddress,
    data: (payload.calldata.startsWith("0x") ? payload.calldata : `0x${payload.calldata}`) as Hex,
    value: BigInt(payload.value),
    gas: BigInt(payload.gas_limit),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return {
    tx_hash: hash,
    block_number: String(receipt.blockNumber),
    status: receipt.status satisfies "success" | "reverted",
  };
}
