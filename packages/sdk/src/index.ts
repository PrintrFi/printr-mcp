/**
 * @printr/sdk - TypeScript SDK for the Printr API
 *
 * Create and manage tokens across EVM chains and Solana.
 *
 * @example
 * ```ts
 * import { createPrintrClient, buildToken, env } from '@printr/sdk';
 *
 * const client = createPrintrClient({
 *   apiKey: env.PRINTR_API_KEY,
 *   baseUrl: env.PRINTR_API_BASE_URL,
 * });
 *
 * const result = await buildToken({
 *   creator_accounts: ['eip155:8453:0x...'],
 *   name: 'My Token',
 *   symbol: 'TKN',
 *   description: 'A cool token',
 *   chains: ['eip155:8453'],
 *   initial_buy: { spend_usd: 10 },
 * }, client);
 * ```
 */

// Array utilities
export { compact, dedupe } from "./array.js";
export { sleep } from "./async.js";
// Balance operations
export {
  type BalanceError,
  type BalanceInfo,
  checkEvmBalance,
  checkSvmBalance,
  fetchNativeBalance,
  fetchTokenBalance,
  getEvmNativeBalance,
  getEvmTokenBalance,
  getSplTokenBalance,
  getSvmNativeBalance,
  resolveRpcUrl,
  type SimpleBalanceResult,
} from "./balance.js";

// CAIP utilities
export {
  type ChainType,
  chainTypeFromCaip2,
  isSupportedNamespace,
  namespaceToChainType,
  type ParsedCaip2,
  type ParsedCaip10,
  parseCaip2,
  parseCaip10,
  type SupportedNamespace,
  toCaip2,
} from "./caip.js";
// Chains
export {
  CHAIN_META,
  type ChainMeta,
  caip10ToChainId,
  createViemChain,
  type EvmConfigResult,
  getChainMeta,
  getEvmConfig,
  getRpcUrl,
  getRpcUrls,
  isSupportedCaip2,
  type SupportedCaip2,
  toCaip2 as toCaip2FromParts,
} from "./chains.js";
// Client
export {
  type ClientConfig,
  createPrintrClient,
  PrintrApiError,
  type PrintrClient,
  type paths,
  type ToolResponse,
  toolError,
  toolOk,
  toToolResponse,
  toToolResponseAsync,
  unwrapResult,
  unwrapResultAsync,
} from "./client.js";
// Environment
export { ALCHEMY_RPC_TEMPLATES, type Env, env, rpcUrlsSchema } from "./env.js";
// EVM operations
export {
  type EvmPayload,
  type EvmSubmitError,
  type EvmSubmitResult,
  formatEvmSubmitError,
  normalisePrivateKey,
  type ParseEvmCaip10Error,
  parseEvmCaip10,
  signAndSubmitEvm,
  tryParseEvmCaip10,
} from "./evm.js";
// Namespaced facade
export {
  balance,
  type GetNativeBalanceParams,
  type GetTokenBalanceParams,
  type SendNativeParams,
  type SendTokenParams,
  tx,
} from "./facade.js";
// Fee API
export {
  Account,
  type AssetAmount,
  type CaipAccount,
  type ChainProtocolFeesSimple,
  formatCaip10 as formatFeeCaip10,
  getProtocolFees,
  type Payload,
  type PayloadEVM,
  type PayloadSolana,
  type ProtocolFeesRequest,
  type ProtocolFeesResponse,
  parseCaip10 as parseFeeCaip10,
  type SolanaAccountMeta,
  type SolanaIx,
} from "./fees-api.js";
// Utilities
export { ensureHex } from "./hex.js";
// Image processing
export {
  buildImagePrompt,
  compressImageBuffer,
  type GenerateImageOptions,
  generateImageFromPrompt,
  generateTokenImage,
  type ImageError,
  processImagePath,
  type TokenImageParams,
} from "./image.js";
// Keystore (wallet encryption)
export {
  addWallet,
  decryptKey,
  encryptKey,
  getWallet,
  keystorePath,
  listWallets,
  removeWallet,
  removeWallets,
  type WalletEntry,
} from "./keystore.js";
// Logger
export { createLogger, logger } from "./logger.js";
// Proto-shared helpers
export {
  type CaipAccount as ProtoCaipAccount,
  formatCaip10 as formatProtoCaip10,
  getBackendClient,
  type ParseCaip10Error as ParseProtoCaip10Error,
  parseCaip10 as parseProtoCaip10,
  toSimpleAccount as toSimpleProtoAccount,
  tryParseCaip10 as tryParseProtoCaip10,
} from "./proto-shared.js";
// Public contract client
export {
  PublicContractClient,
  type PublicContractClientConfig,
} from "./public-contract-client.js";
// RPC fallback
export { isRetryableRpcError, type RpcInput, toRpcList, withRpcFallback } from "./rpc.js";
// Schemas
export {
  asset,
  caip2ChainId,
  caip10Address,
  cost,
  externalLinks,
  graduationThreshold,
  initialBuy,
  quoteOutput,
  tokenId,
} from "./schemas.js";
// Staking API
export {
  type CaipAccount as StakingCaipAccount,
  type ClaimStakingRewardsParams,
  type ClaimStakingRewardsResult,
  type CreateStakePositionParams,
  type CreateStakePositionResult,
  claimStakingRewards,
  createStakePosition,
  formatCaip10 as formatStakingCaip10,
  type ListStakePositionsParams,
  type ListStakePositionsWithRewardsResult,
  listStakePositionsWithRewards,
  type ParseLockPeriodError,
  parseCaip10 as parseStakingCaip10,
  parseLockPeriod,
  type SimpleAssetAmount,
  type SimpleEvmPayload,
  type SimpleSolanaIx,
  type SimpleSolanaPayload,
  type SimpleStakePoolInfo,
  type SimpleStakePositionInfo,
  type SimpleStakePositionWithRewards,
  type SimpleTelecoinInfo,
  type SimpleTokenAmount,
  type SimpleTxPayload,
  StakingLockPeriod,
  tryParseLockPeriod,
} from "./staking-api.js";
// State management
export {
  type ChainTypeKey,
  clearActiveWalletId,
  clearLastDeploymentWalletId,
  createStateRepo,
  getActiveWalletId,
  getLastDeploymentWalletId,
  getState,
  getTreasuryWalletId,
  type PersistentState,
  type StateDeps,
  type StateError,
  type StateRepo,
  setActiveWalletId,
  setLastDeploymentWalletId,
  setTreasuryWalletId,
  statePath,
} from "./state.js";
// SVM (Solana) operations
export {
  DEFAULT_SVM_RPC,
  formatSvmSubmitError,
  getSvmRpcUrl,
  getSvmRpcUrls,
  isHttpOnlyRpc,
  SOLANA_MAINNET_CAIP2,
  type SvmInstruction,
  type SvmPayload,
  type SvmSubmitError,
  type SvmSubmitResult,
  sendAndConfirmSvmTransaction,
  signAndSubmitSvm,
} from "./svm.js";
// Token operations
export { type BuildTokenInput, buildToken, type FeeSink } from "./token.js";
// Transfer operations
export {
  type EvmTransferResult,
  executeTokenTransfer,
  executeTransfer,
  type SvmTransferResult,
  type TransferError,
  type TransferResult,
  transferErc20,
  transferEvm,
  transferSplToken,
  transferSvm,
} from "./transfer.js";
