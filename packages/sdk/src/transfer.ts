import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  ExtensionType,
  getAssociatedTokenAddress,
  getExtensionTypes,
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
import { match } from "ts-pattern";
import { createPublicClient, createWalletClient, erc20Abi, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { parseCaip10, toCaip2 } from "./caip.js";
import type { ChainMeta } from "./chains.js";
import { createViemChain, getRpcUrl } from "./chains.js";
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

/**
 * Send the native gas token on an EVM chain. `amount` is in atomic units (wei).
 * Throws if the RPC call fails. Use {@link executeTransfer} for namespace-agnostic transfers.
 */
export const transferEvm = async (
  chainId: number,
  toAddress: `0x${string}`,
  amount: bigint,
  privateKey: string,
  rpcUrl: string,
  meta: ChainMeta,
): Promise<EvmTransferResult> => {
  const chain = createViemChain(chainId, rpcUrl, meta);
  const account = privateKeyToAccount(normalisePrivateKey(privateKey));
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  const hash = await walletClient.sendTransaction({ to: toAddress, value: amount });

  return { type: "evm", tx_hash: hash, amount_atomic: amount.toString() };
};

/**
 * Send native SOL. `lamports` is in atomic units (1 SOL = 1e9 lamports).
 * `privateKey` is the base58-encoded secret key. Confirms before resolving.
 */
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

/**
 * Chain-agnostic native transfer. Accepts a human-readable `amount` and converts
 * it to atomic units using `meta.decimals` (or 9 for Solana lamports).
 * Dispatches to {@link transferSvm} or {@link transferEvm} based on namespace.
 */
export const executeTransfer = (
  namespace: string,
  chainRef: string,
  toAddress: string,
  amount: string,
  privateKey: string,
  meta: ChainMeta,
  rpcOverride?: string,
): ResultAsync<TransferResult, TransferError> =>
  match(namespace)
    .with("solana", () => {
      const rpc = getSvmRpcUrl(rpcOverride);
      const lamports = BigInt(Math.floor(Number.parseFloat(amount) * LAMPORTS_PER_SOL));
      return ResultAsync.fromPromise(
        transferSvm(toAddress, lamports, privateKey, rpc),
        toTransferError,
      );
    })
    .otherwise(() => {
      const caip2 = `eip155:${chainRef}`;
      const rpc = getRpcUrl(caip2, rpcOverride);
      if (!rpc) {
        return errAsync({
          message: `No RPC URL for chain ${caip2}. Pass rpc_url explicitly or set RPC_URLS.`,
        });
      }
      const amountAtomic = parseUnits(amount, meta.decimals);
      return ResultAsync.fromPromise(
        transferEvm(
          Number(chainRef),
          toAddress as `0x${string}`,
          amountAtomic,
          privateKey,
          rpc,
          meta,
        ),
        toTransferError,
      );
    });

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
  const chain = createViemChain(chainId, rpcUrl, meta);
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

type SplMintInfo = { programId: PublicKey; decimals: number };

/**
 * Fetch the program ID and decimals for an SPL mint, rejecting Token-2022 mints
 * that use extensions ({@link ExtensionType}). Single round-trip for both pieces.
 *
 * Token-2022 extensions like `TransferFee`, `TransferHook`, and
 * `ConfidentialTransferMint` require extension-aware instructions and additional
 * accounts that {@link transferSplToken} does not currently emit. We surface a
 * clear error rather than silently producing a transaction that will fail
 * on-chain.
 */
const fetchSplMintInfo = async (connection: Connection, mint: PublicKey): Promise<SplMintInfo> => {
  const mintAccount = await connection.getAccountInfo(mint);
  if (!mintAccount) {
    throw new Error(`Mint not found: ${mint.toBase58()}`);
  }
  const programId = mintAccount.owner;
  const mintInfo = await getMint(connection, mint, undefined, programId);

  const extensions = getExtensionTypes(mintInfo.tlvData);
  if (extensions.length > 0) {
    const names = extensions.map((e) => ExtensionType[e]).join(", ");
    throw new Error(
      `SPL mint ${mint.toBase58()} uses Token-2022 extensions (${names}) which are not ` +
        `supported by transferSplToken. Tokens with extensions like TransferFee or ` +
        `TransferHook require extension-aware instructions and additional accounts.`,
    );
  }

  return { programId, decimals: mintInfo.decimals };
};

/**
 * Transfer an SPL token on Solana.
 *
 * Auto-detects the token program (SPL classic or Token-2022 without extensions) from
 * the mint account owner, fetches the mint's decimals, and idempotently ensures the
 * recipient's associated token account exists (the sender pays the rent if it has to
 * be created).
 *
 * Token-2022 mints that enable extensions are rejected with a clear error — see
 * {@link fetchSplMintInfo}.
 *
 * The caller is responsible for ensuring `amount` is in the token's atomic units
 * (use {@link executeTokenTransfer} for human-readable amounts with auto-detected decimals).
 *
 * @param toAddress - Recipient Solana address — must be the **owner wallet**, not an
 *   associated token account; the ATA is derived automatically
 * @param mintAddress - SPL token mint address
 * @param amount - Transfer amount in atomic units (smallest unit, per mint decimals)
 * @param privateKey - Sender keypair as a base58-encoded secret key
 * @param rpcUrl - Solana JSON-RPC endpoint URL
 * @param mintInfo - Optional pre-fetched mint info to skip the on-chain lookup;
 *   {@link executeTokenTransfer} passes this through after fetching once for decimals
 * @returns Transaction signature and the amount sent
 * @throws If the mint is not found, uses unsupported Token-2022 extensions, or the
 *   transaction errors
 */
export const transferSplToken = async (
  toAddress: string,
  mintAddress: string,
  amount: bigint,
  privateKey: string,
  rpcUrl: string,
  mintInfo?: SplMintInfo,
): Promise<SvmTransferResult> => {
  const connection = new Connection(rpcUrl, "confirmed");
  const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  const mint = new PublicKey(mintAddress);
  const recipient = new PublicKey(toAddress);

  const { programId, decimals } = mintInfo ?? (await fetchSplMintInfo(connection, mint));

  const sourceAta = await getAssociatedTokenAddress(mint, keypair.publicKey, false, programId);
  const destAta = await getAssociatedTokenAddress(mint, recipient, false, programId);

  const transaction = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      keypair.publicKey,
      destAta,
      recipient,
      mint,
      programId,
    ),
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
  const chain = createViemChain(chainId, rpcUrl, meta);
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  return client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
  });
};

/**
 * Dispatch a fungible-token transfer to the appropriate chain implementation.
 *
 * Mirrors {@link executeTransfer} but for ERC20 / SPL tokens instead of native coins.
 * The `token` parameter is a CAIP-10 token ID (e.g. `eip155:8453:0x...` or
 * `solana:5eykt...:<mint>`); the dispatcher rejects tokens that do not belong to the
 * same chain as the recipient before any RPC call. Decimals are auto-detected from
 * the contract (`decimals()`) on EVM or from the mint account on Solana, and the
 * human-readable `amount` is parsed against them.
 *
 * @param namespace - CAIP-2 namespace: `"eip155"` or `"solana"`
 * @param chainRef - Chain reference: numeric chain ID for EVM, base58 genesis hash for Solana
 * @param toAddress - Recipient address (raw, not CAIP-10)
 * @param token - CAIP-10 token ID (`<namespace>:<chainRef>:<contract-or-mint>`); must
 *   match `namespace`/`chainRef`
 * @param amount - Human-readable amount (e.g. `"1.5"` for 1.5 USDC)
 * @param privateKey - Sender private key (hex for EVM, base58 secret key for Solana)
 * @param meta - Chain metadata for the destination chain
 * @param rpcOverride - Optional RPC endpoint override
 * @returns Result with the transfer outcome ({@link TransferResult}) or a {@link TransferError}
 *   (including chain-mismatch errors)
 */
export const executeTokenTransfer = (
  namespace: string,
  chainRef: string,
  toAddress: string,
  token: string,
  amount: string,
  privateKey: string,
  meta: ChainMeta,
  rpcOverride?: string,
): ResultAsync<TransferResult, TransferError> => {
  const expectedChain = toCaip2({ namespace, chainRef });

  const tokenParsed = parseCaip10(token);
  if (!tokenParsed) {
    return errAsync({ message: `Invalid CAIP-10 token: ${token}` });
  }
  const tokenChain = toCaip2(tokenParsed);
  if (tokenChain !== expectedChain) {
    return errAsync({
      message: `Token chain mismatch. Token is on ${tokenChain}, recipient is on ${expectedChain}.`,
    });
  }
  const tokenAddress = tokenParsed.address;

  return match(namespace)
    .with("solana", () => {
      const rpc = getSvmRpcUrl(rpcOverride);
      const connection = new Connection(rpc, "confirmed");
      const mint = new PublicKey(tokenAddress);
      return ResultAsync.fromPromise(fetchSplMintInfo(connection, mint), toTransferError).andThen(
        (mintInfo) =>
          ResultAsync.fromPromise(
            transferSplToken(
              toAddress,
              tokenAddress,
              parseUnits(amount, mintInfo.decimals),
              privateKey,
              rpc,
              mintInfo,
            ),
            toTransferError,
          ),
      );
    })
    .otherwise(() => {
      const rpc = getRpcUrl(expectedChain, rpcOverride);
      if (!rpc) {
        return errAsync({
          message: `No RPC URL for chain ${expectedChain}. Pass rpc_url explicitly or set RPC_URLS.`,
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
    });
};
