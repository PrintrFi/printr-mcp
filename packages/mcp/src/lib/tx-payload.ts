import type { SimpleTxPayload } from "@printr/sdk";

/** The `value` of the EVM variant of a backend {@link SimpleTxPayload}. */
export type EvmTxValue = Extract<SimpleTxPayload, { case: "evm" }>["value"];

/** The `value` of the Solana variant of a backend {@link SimpleTxPayload}. */
export type SvmTxValue = Extract<SimpleTxPayload, { case: "solana" }>["value"];
