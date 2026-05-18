import {
  type Abi,
  type Chain,
  type ContractFunctionName,
  createPublicClient,
  type PublicClient,
  type ReadContractParameters,
  type ReadContractReturnType,
  type Transport,
} from "viem";

/** Config for constructing a {@link PublicContractClient}. */
export interface PublicContractClientConfig<TAbi extends Abi> {
  /** Contract address on `chain`. */
  address: `0x${string}`;
  /** ABI — the type parameter `TAbi` powers `read` narrowing. */
  abi: TAbi;
  /** viem chain definition. */
  chain: Chain;
  /** viem transport (typically `http(rpcUrl)`). */
  transport: Transport;
}

/**
 * Typed wrapper around a single contract's read surface.
 *
 * Bakes in `address` + `abi` so callers don't repeat them per read, and
 * narrows `functionName` / args / return type against the ABI tuple so
 * typos and arity mismatches surface at compile time.
 *
 * @example
 * ```ts
 * const erc20 = new PublicContractClient({ address, abi: erc20Abi, chain, transport });
 * const balance = await erc20.read({ functionName: "balanceOf", args: [wallet] });
 * const decimals = await erc20.read({ functionName: "decimals" });
 * ```
 */
export class PublicContractClient<TAbi extends Abi> {
  readonly address: `0x${string}`;
  readonly abi: TAbi;
  protected readonly client: PublicClient;

  constructor(config: PublicContractClientConfig<TAbi>) {
    this.address = config.address;
    this.abi = config.abi;
    this.client = createPublicClient({ chain: config.chain, transport: config.transport });
  }

  /**
   * Call a view/pure function. The return type is narrowed to the function's
   * declared output in the ABI.
   */
  read<TFunctionName extends ContractFunctionName<TAbi, "view" | "pure">>(
    params: Omit<ReadContractParameters<TAbi, TFunctionName>, "address" | "abi">,
  ): Promise<ReadContractReturnType<TAbi, TFunctionName>> {
    return this.client.readContract({
      ...params,
      address: this.address,
      abi: this.abi,
    } as ReadContractParameters<TAbi, TFunctionName>) as Promise<
      ReadContractReturnType<TAbi, TFunctionName>
    >;
  }
}
