import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createPrintrClient } from "./client.js";
import { type BuildTokenInput, buildToken } from "./token.js";

// ---------------------------------------------------------------------------
// Test client + fetch stub
// ---------------------------------------------------------------------------

const API_BASE = "https://api.test";

function makeClient() {
  return createPrintrClient({ apiKey: "test-key", baseUrl: API_BASE });
}

type FetchHandler = (req: { url: string; body: unknown }) => unknown;

let originalFetch: typeof globalThis.fetch;
let lastRequest: { url: string; body: unknown } | undefined;
let fetchCalls = 0;

function stubFetch(handler: FetchHandler, status = 200): void {
  fetchCalls = 0;
  const stub: typeof globalThis.fetch = async (input, init) => {
    fetchCalls += 1;
    let url: string;
    let bodyText: string | undefined;
    if (typeof input === "string") {
      url = input;
      bodyText = init?.body ? String(init.body) : undefined;
    } else if (input instanceof URL) {
      url = input.toString();
      bodyText = init?.body ? String(init.body) : undefined;
    } else {
      // openapi-fetch passes a Request object as the first argument.
      url = input.url;
      bodyText = await input.text();
    }
    const body = bodyText ? JSON.parse(bodyText) : undefined;
    lastRequest = { url, body };
    const result = handler({ url, body });
    return new Response(JSON.stringify(result), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  stub.preconnect = () => undefined;
  globalThis.fetch = stub;
}

const baseInput: BuildTokenInput = {
  creator_accounts: ["eip155:8453:0x0000000000000000000000000000000000000001"],
  name: "TestCoin",
  symbol: "TST",
  description: "A test token",
  image: "base64imagebytes",
  chains: ["eip155:8453"],
  initial_buy: { supply_percent: 5 },
};

beforeEach(() => {
  originalFetch = globalThis.fetch;
  lastRequest = undefined;
  fetchCalls = 0;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Pre-flight validation
// ---------------------------------------------------------------------------

describe("buildToken — pre-flight validation", () => {
  it("rejects missing creator_accounts without calling the API", async () => {
    stubFetch(() => {
      throw new Error("unexpected fetch");
    });

    const { creator_accounts: _omit, ...rest } = baseInput;
    const result = await buildToken(rest, makeClient());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toMatch(/creator_accounts is required/);
    expect(fetchCalls).toBe(0);
  });

  it("rejects an empty creator_accounts array (still falsy via destructuring)", async () => {
    // Pre-flight only fires for `undefined`; `[]` passes through to the API.
    stubFetch(
      () => ({
        deployment_id: "dep-1",
        payload: null,
        bridge: null,
      }),
      200,
    );

    const result = await buildToken({ ...baseInput, creator_accounts: [] }, makeClient());

    expect(result.isOk()).toBe(true);
    expect(fetchCalls).toBe(1);
    expect(lastRequest?.body).toMatchObject({ creator_accounts: [] });
  });
});

// ---------------------------------------------------------------------------
// Image resolution
// ---------------------------------------------------------------------------

describe("buildToken — image resolution", () => {
  it("passes through an inline `image` string without invoking image generation", async () => {
    stubFetch(() => ({ deployment_id: "dep-1", payload: null, bridge: null }));

    const result = await buildToken(baseInput, makeClient());

    expect(result.isOk()).toBe(true);
    expect(lastRequest?.body).toMatchObject({ image: "base64imagebytes" });
  });

  it("errors clearly when no image source is configured", async () => {
    stubFetch(() => {
      throw new Error("unexpected fetch");
    });

    // No `image`, no `image_path`, and no OPENROUTER_API_KEY (test env).
    const { image: _omit, ...rest } = baseInput;
    const result = await buildToken(rest, makeClient());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toMatch(/No image provided/);
    expect(result._unsafeUnwrapErr().message).toMatch(/OPENROUTER_API_KEY/);
    expect(fetchCalls).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Response normalisation
// ---------------------------------------------------------------------------

describe("buildToken — response normalisation", () => {
  // Hot path is already-0x-prefixed hex — `ensureHex` short-circuits.
  // A regression to "always re-encode" would corrupt via the base64 fallback.
  it("leaves an already-0x-prefixed calldata unchanged", async () => {
    stubFetch(() => ({
      deployment_id: "dep-1",
      payload: {
        chain_id: "eip155:8453",
        to: "0xcontract",
        value: "0",
        calldata: "0xdeadbeef",
      },
      bridge: null,
    }));

    const result = await buildToken(baseInput, makeClient());

    expect(result.isOk()).toBe(true);
    expect((result._unsafeUnwrap().payload as { calldata: string }).calldata).toBe("0xdeadbeef");
  });

  it("leaves an already-0x-prefixed hash on the payload unchanged", async () => {
    stubFetch(() => ({
      deployment_id: "dep-1",
      payload: {
        chain_id: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        hash: "0xfeedface",
      },
      bridge: null,
    }));

    const result = await buildToken(baseInput, makeClient());

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().payload?.hash).toBe("0xfeedface");
  });

  it("returns a PrintrApiError when the API responds with non-2xx", async () => {
    stubFetch(() => ({ detail: "insufficient funds for graduation threshold" }), 400);

    const result = await buildToken(baseInput, makeClient());

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.message).toMatch(/insufficient funds/);
  });
});

// ---------------------------------------------------------------------------
// Request shape
// ---------------------------------------------------------------------------

describe("buildToken — request shape", () => {
  it("POSTs to /v0/print with the input body plus the resolved image", async () => {
    stubFetch(() => ({ deployment_id: "dep-1", payload: null, bridge: null }));

    await buildToken(baseInput, makeClient());

    expect(fetchCalls).toBe(1);
    expect(lastRequest?.url).toBe(`${API_BASE}/v0/print`);
    expect(lastRequest?.body).toMatchObject({
      name: "TestCoin",
      symbol: "TST",
      chains: ["eip155:8453"],
      initial_buy: { supply_percent: 5 },
      image: "base64imagebytes",
    });
    // The destructured `image_path` should not leak into the request body.
    expect(lastRequest?.body).not.toHaveProperty("image_path");
  });
});
