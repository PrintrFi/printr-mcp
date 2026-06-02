import {
  type EvmSubmitError,
  type EvmSubmitResult,
  type SvmSubmitError,
  type SvmSubmitResult,
  tryParseEvmCaip10,
} from "@printr/sdk";
import { err, errAsync, ok, type Result, type ResultAsync } from "neverthrow";
import { z } from "zod";
import type { Signer, SignerError } from "./port.js";

/** onchainos's chain id for Solana mainnet (its own numbering, not a CAIP-2 reference). */
const ONCHAINOS_SOLANA_CHAIN_ID = 501;

const DEFAULT_BIZ_TYPE = "dapp";

const HexString = z.custom<`0x${string}`>((v) => typeof v === "string" && v.startsWith("0x"));

/** Shape of `onchainos wallet addresses` JSON output. */
const AddressesResponse = z.object({
  data: z
    .object({
      address: z.string().optional(),
      addresses: z.array(z.string()).optional(),
      details: z
        .array(z.object({ tokenAssets: z.array(z.object({ address: z.string() })).optional() }))
        .optional(),
    })
    .optional(),
});

/** Shape of `onchainos wallet contract-call` JSON output. */
const ContractCallResponse = z.object({
  data: z.object({ txHash: HexString.optional(), blockNumber: z.string().optional() }).optional(),
});

/**
 * Runs the `onchainos` CLI with `args` and resolves its stdout, or rejects with a
 * human-readable error string. Injected so the adapter stays pure and testable —
 * tests pass a fake; production passes a child_process runner.
 */
export type OnchainosExec = (args: readonly string[]) => ResultAsync<string, string>;

export type OnchainosDeps = {
  exec: OnchainosExec;
  /** Attribution passed as `--strategy` (the plugin name). */
  strategy: string;
  /** Attribution passed as `--biz-type` (defaults to "dapp"). */
  bizType?: string;
};

/** Map a CAIP-2 id to the chain id onchainos expects on the `--chain` flag. */
export function onchainosChainId(caip2: string): number | null {
  const [namespace, reference] = caip2.split(":");
  if (namespace === "solana") {
    return ONCHAINOS_SOLANA_CHAIN_ID;
  }
  if (namespace === "eip155") {
    const id = Number(reference);
    return Number.isInteger(id) ? id : null;
  }
  return null;
}

/**
 * Build the argument vector for an EVM `onchainos wallet contract-call`.
 *
 * Pure and unit-tested — encodes the invocation shape observed in the OKX
 * reference plugins (see docs/onchainos-integration.md). `--amt` is omitted for
 * zero-value calls; `--force` broadcasts (without it onchainos only simulates).
 */
export type EvmContractCallArgs = {
  chainId: number;
  to: string;
  calldata: string;
  value: string;
  from?: string | undefined;
  strategy: string;
  bizType: string;
};

export function buildEvmContractCallArgs(p: EvmContractCallArgs): string[] {
  const args = [
    "wallet",
    "contract-call",
    "--biz-type",
    p.bizType,
    "--strategy",
    p.strategy,
    "--chain",
    String(p.chainId),
    "--to",
    p.to,
    "--input-data",
    p.calldata,
  ];
  if (p.value && p.value !== "0") {
    args.push("--amt", p.value);
  }
  if (p.from) {
    args.push("--from", p.from);
  }
  args.push("--force");
  return args;
}

/** Extract a wallet address from `onchainos wallet addresses` JSON output. */
export function parseAddressFromOutput(stdout: string): string | null {
  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    return null;
  }
  const parsed = AddressesResponse.safeParse(json);
  if (!parsed.success) {
    return null;
  }
  const data = parsed.data.data;
  return (
    data?.address ?? data?.details?.[0]?.tokenAssets?.[0]?.address ?? data?.addresses?.[0] ?? null
  );
}

/** Parse an `onchainos wallet contract-call` response into an {@link EvmSubmitResult}. */
export function parseEvmSubmit(stdout: string): Result<EvmSubmitResult, EvmSubmitError> {
  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    return err({
      kind: "broadcast_failed",
      message: `onchainos returned non-JSON output: ${stdout}`,
    });
  }
  const parsed = ContractCallResponse.safeParse(json);
  if (!parsed.success) {
    return err({ kind: "broadcast_failed", message: `onchainos response malformed: ${stdout}` });
  }
  const data = parsed.data.data;
  if (!data?.txHash) {
    return err({
      kind: "broadcast_failed",
      message: `onchainos response missing txHash: ${stdout}`,
    });
  }
  return ok({ tx_hash: data.txHash, block_number: data.blockNumber ?? "0", status: "success" });
}

/**
 * Build a {@link Signer} backed by OKX onchainos (TEE-backed signing). The key
 * never enters this process — calldata is built here and signing is delegated to
 * the TEE via the `onchainos` CLI.
 *
 * The autonomous path for the OKX channel (see docs/adr/0001-okx-signing-architecture.md).
 *
 * NOTE: integration is pending confirmation from OKX on chain coverage and
 * headless auth (see docs/onchainos-integration.md). The SVM path additionally
 * needs the unsigned-tx assembly split tracked in issue #7; until then it returns
 * a `signing_failed` error. Receipt confirmation polling is a follow-up.
 */
export function onchainosSigner(deps: OnchainosDeps): Signer {
  const bizType = deps.bizType ?? DEFAULT_BIZ_TYPE;
  return {
    kind: "onchainos",
    resolveAddress: (caip2) => {
      const chainId = onchainosChainId(caip2);
      if (chainId === null) {
        return errAsync<string, SignerError>({ kind: "unsupported_chain", caip2 });
      }
      return deps
        .exec(["wallet", "addresses", "--chain", String(chainId)])
        .mapErr((message): SignerError => ({ kind: "resolution_failed", message }))
        .andThen((stdout) => {
          const address = parseAddressFromOutput(stdout);
          return address
            ? ok(address)
            : err<string, SignerError>({
                kind: "wallet_unavailable",
                message: "No onchainos wallet found. Run `onchainos wallet login <email>` first.",
              });
        });
    },
    signAndSubmitEvm: (payload) =>
      tryParseEvmCaip10(payload.to)
        .mapErr((): EvmSubmitError => ({ kind: "invalid_caip10", input: payload.to }))
        .asyncAndThen(({ chainId, address }) =>
          deps
            .exec(
              buildEvmContractCallArgs({
                chainId,
                to: address,
                calldata: payload.calldata,
                value: payload.value,
                strategy: deps.strategy,
                bizType,
              }),
            )
            .mapErr((message): EvmSubmitError => ({ kind: "broadcast_failed", message }))
            .andThen(parseEvmSubmit),
        ),
    signAndSubmitSvm: () =>
      errAsync<SvmSubmitResult, SvmSubmitError>({
        kind: "signing_failed",
        message: "onchainos Solana signing requires unsigned-tx assembly (pending issue #7).",
      }),
  };
}
