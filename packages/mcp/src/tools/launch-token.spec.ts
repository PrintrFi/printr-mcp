import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { type ChainType, createPrintrClient } from "@printr/sdk";
import { okAsync } from "neverthrow";
import {
  type DrainOutcome,
  drainFields,
  isEvmPayload,
  type LaunchTokenDeps,
  type LaunchTokenInput,
  launchTokenHandler,
} from "./launch-token.js";

// ---------------------------------------------------------------------------
// isEvmPayload
// ---------------------------------------------------------------------------

describe("isEvmPayload", () => {
  it("returns true for an object with a calldata field", () => {
    expect(
      isEvmPayload({
        to: "eip155:8453:0xcontract",
        calldata: "0xdeadbeef",
        value: "0",
        gas_limit: 200000,
      }),
    ).toBe(true);
  });

  it("returns true even when calldata is empty (presence is the discriminator)", () => {
    expect(isEvmPayload({ calldata: "" })).toBe(true);
  });

  it("returns false for an SVM-shaped payload with ixs but no calldata", () => {
    expect(
      isEvmPayload({
        ixs: [{ program_id: "11111111111111111111111111111111", accounts: [], data: "" }],
        lookup_table: undefined,
        mint_address: "",
      }),
    ).toBe(false);
  });

  // Wrap each value in an outer array — bun:test's `it.each` spreads the entry
  // into the callback args; a bare `[]` entry would spread to zero args and the
  // runner would expect the callback's first param to be `done`.
  it.each([
    [null],
    [undefined],
    ["calldata"],
    [42],
    [[]],
    [true],
  ])("returns false for non-object payload %p", (value) => {
    expect(isEvmPayload(value)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// drainFields
// ---------------------------------------------------------------------------

describe("drainFields", () => {
  it("projects an ok outcome to status + wallet_id (no error field)", () => {
    const outcome: DrainOutcome = { status: "ok", walletId: "wallet-42" };
    const fields = drainFields(outcome);
    expect(fields).toEqual({ drain_status: "ok", drain_wallet_id: "wallet-42" });
    expect("drain_error" in fields).toBe(false);
  });

  it("projects a failed outcome to status + wallet_id + error", () => {
    const outcome: DrainOutcome = {
      status: "failed",
      walletId: "wallet-42",
      error: "insufficient gas",
    };
    expect(drainFields(outcome)).toEqual({
      drain_status: "failed",
      drain_wallet_id: "wallet-42",
      drain_error: "insufficient gas",
    });
  });

  it("projects a skipped outcome to status only (no wallet_id leak)", () => {
    const fields = drainFields({ status: "skipped" });
    expect(fields).toEqual({ drain_status: "skipped" });
    expect("drain_wallet_id" in fields).toBe(false);
    expect("drain_error" in fields).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// launchTokenHandler — full handler with stubbed deps
// ---------------------------------------------------------------------------

const API_BASE = "https://api.test";

type CallRecord = {
  signWithKey: { args: unknown[] }[];
  openWebSigner: { args: unknown[] }[];
  autoDrain: { args: unknown[] }[];
  printBody?: unknown;
};

function makeStubFetch(printResponse: () => Record<string, unknown>): {
  fetch: typeof globalThis.fetch;
  getPrintBody: () => unknown;
} {
  let printBody: unknown;
  const stub: typeof globalThis.fetch = async (input, init) => {
    let url: string;
    let bodyText: string | undefined;
    if (typeof input === "string") {
      url = input;
      bodyText = init?.body ? String(init.body) : undefined;
    } else if (input instanceof URL) {
      url = input.toString();
      bodyText = init?.body ? String(init.body) : undefined;
    } else {
      url = input.url;
      bodyText = await input.text();
    }
    if (url.endsWith("/v0/print") && bodyText) {
      printBody = JSON.parse(bodyText);
    }
    return new Response(JSON.stringify(printResponse()), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  stub.preconnect = () => undefined;
  return { fetch: stub, getPrintBody: () => printBody };
}

function makeDeps(
  fetch: typeof globalThis.fetch,
  record: CallRecord,
  overrides: Partial<LaunchTokenDeps> = {},
): LaunchTokenDeps {
  // Install the stub long enough for the client's constructor to see it; tests
  // re-install the stub before invoking the handler.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetch;
  const client = createPrintrClient({ apiKey: "test-key", baseUrl: API_BASE });
  globalThis.fetch = originalFetch;
  return {
    client,
    activeWallets: new Map(),
    signWithKey: (...args) => {
      record.signWithKey.push({ args });
      return okAsync({
        status: "submitted" as const,
        token_id: "0xdeadbeef",
        quote: { total_cost_usd: 10 },
        tx_hash: "0xtxhash",
        block_number: "1",
        tx_status: "success" as const,
      });
    },
    openWebSigner: (...args) => {
      record.openWebSigner.push({ args });
      return okAsync({
        status: "awaiting_signature" as const,
        token_id: "0xdeadbeef",
        quote: { total_cost_usd: 10 },
        url: "https://app.printr.money/sign?session=abc&api=https%3A%2F%2Flocal.printr.dev%3A1234",
        session_token: "abc",
        api_port: 1234,
        expires_at: Date.now() + 60_000,
      });
    },
    autoDrain: async (...args) => {
      record.autoDrain.push({ args });
      return { status: "ok" as const, walletId: "drain-wallet" };
    },
    ...overrides,
  };
}

const baseInput: LaunchTokenInput = {
  name: "TestCoin",
  symbol: "TST",
  description: "A test token",
  chains: ["eip155:8453"],
  initial_buy: { supply_percent: 5 },
  image: "base64imagebytes",
  creator_accounts: ["eip155:8453:0x0000000000000000000000000000000000000001"],
} as unknown as LaunchTokenInput;

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("launchTokenHandler — signing-path branching", () => {
  it("uses signWithKey when private_key is supplied (and skips drain)", async () => {
    const record: CallRecord = { signWithKey: [], openWebSigner: [], autoDrain: [] };
    const { fetch: stubbedFetch } = makeStubFetch(() => ({
      deployment_id: "dep-1",
      token_id: "0xdeadbeef",
      payload: { calldata: "0xabc", to: "eip155:8453:0xcontract", value: "0", gas_limit: 200000 },
      quote: { total_cost_usd: 10 },
    }));
    const deps = makeDeps(stubbedFetch, record);
    globalThis.fetch = stubbedFetch;

    const result = await launchTokenHandler(
      { ...baseInput, private_key: "0x".padEnd(66, "1") },
      deps,
    );

    expect(record.signWithKey).toHaveLength(1);
    expect(record.openWebSigner).toHaveLength(0);
    expect(record.autoDrain).toHaveLength(0);
    expect(
      (result as { structuredContent?: { drain_status?: string } }).structuredContent?.drain_status,
    ).toBe("skipped");
  });

  it("falls back to the activeWallet's privateKey when no private_key is supplied", async () => {
    const record: CallRecord = { signWithKey: [], openWebSigner: [], autoDrain: [] };
    const { fetch: stubbedFetch } = makeStubFetch(() => ({
      deployment_id: "dep-1",
      token_id: "0xdeadbeef",
      payload: { calldata: "0xabc", to: "eip155:8453:0xcontract", value: "0", gas_limit: 200000 },
      quote: { total_cost_usd: 10 },
    }));
    const deps = makeDeps(stubbedFetch, record);
    deps.activeWallets.set("evm" as ChainType, {
      privateKey: "0xfallback",
      address: "0xfallbackAddr",
    });
    globalThis.fetch = stubbedFetch;

    await launchTokenHandler(baseInput, deps);

    expect(record.signWithKey).toHaveLength(1);
    expect(record.signWithKey[0]?.args[3]).toBe("0xfallback");
    expect(record.autoDrain).toHaveLength(1);
  });

  it("uses openWebSigner when no private_key and no active wallet exist", async () => {
    const record: CallRecord = { signWithKey: [], openWebSigner: [], autoDrain: [] };
    const { fetch: stubbedFetch } = makeStubFetch(() => ({
      deployment_id: "dep-1",
      token_id: "0xdeadbeef",
      payload: { calldata: "0xabc", to: "eip155:8453:0xcontract", value: "0", gas_limit: 200000 },
      quote: { total_cost_usd: 10 },
    }));
    const deps = makeDeps(stubbedFetch, record);
    globalThis.fetch = stubbedFetch;

    await launchTokenHandler(baseInput, deps);

    expect(record.signWithKey).toHaveLength(0);
    expect(record.openWebSigner).toHaveLength(1);
    expect(record.autoDrain).toHaveLength(0);
  });
});

describe("launchTokenHandler — creator_accounts derivation", () => {
  it("derives creator_accounts per chain from the active wallet address when missing", async () => {
    const record: CallRecord = { signWithKey: [], openWebSigner: [], autoDrain: [] };
    const { fetch: stubbedFetch, getPrintBody } = makeStubFetch(() => ({
      deployment_id: "dep-1",
      token_id: "0xdeadbeef",
      payload: { calldata: "0xabc", to: "eip155:8453:0xcontract", value: "0", gas_limit: 200000 },
      quote: { total_cost_usd: 10 },
    }));
    const deps = makeDeps(stubbedFetch, record);
    deps.activeWallets.set("evm" as ChainType, {
      privateKey: "0xfallback",
      address: "0xfallbackAddr",
    });
    globalThis.fetch = stubbedFetch;

    const { creator_accounts: _omit, ...rest } = baseInput;
    await launchTokenHandler(rest as LaunchTokenInput, deps);

    const sent = getPrintBody() as { creator_accounts: string[] };
    expect(sent.creator_accounts).toEqual(["eip155:8453:0xfallbackAddr"]);
  });

  it("preserves explicit creator_accounts when supplied", async () => {
    const record: CallRecord = { signWithKey: [], openWebSigner: [], autoDrain: [] };
    const { fetch: stubbedFetch, getPrintBody } = makeStubFetch(() => ({
      deployment_id: "dep-1",
      token_id: "0xdeadbeef",
      payload: { calldata: "0xabc", to: "eip155:8453:0xcontract", value: "0", gas_limit: 200000 },
      quote: { total_cost_usd: 10 },
    }));
    const deps = makeDeps(stubbedFetch, record);
    deps.activeWallets.set("evm" as ChainType, {
      privateKey: "0xfallback",
      address: "0xfallbackAddr",
    });
    globalThis.fetch = stubbedFetch;

    await launchTokenHandler(baseInput, deps);

    const sent = getPrintBody() as { creator_accounts: string[] };
    expect(sent.creator_accounts).toEqual([
      "eip155:8453:0x0000000000000000000000000000000000000001",
    ]);
  });
});

describe("launchTokenHandler — drain gating", () => {
  it("skips drain when the launch fails (PrintrApiError surfaced as isError response)", async () => {
    const record: CallRecord = { signWithKey: [], openWebSigner: [], autoDrain: [] };
    const stub: typeof globalThis.fetch = async () =>
      new Response(JSON.stringify({ detail: "rejected" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    stub.preconnect = () => undefined;
    const deps = makeDeps(stub, record);
    deps.activeWallets.set("evm" as ChainType, {
      privateKey: "0xfallback",
      address: "0xfallbackAddr",
    });
    globalThis.fetch = stub;

    const result = await launchTokenHandler(baseInput, deps);

    expect(record.autoDrain).toHaveLength(0);
    expect((result as { isError?: boolean }).isError).toBe(true);
  });
});
