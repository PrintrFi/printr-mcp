import { describe, expect, it } from "bun:test";
import { err, ok } from "neverthrow";

import { createPrintrClient, PrintrApiError, toToolResponse, unwrapResult } from "./client.js";

describe("createPrintrClient", () => {
  it("creates a client with correct configuration", () => {
    const client = createPrintrClient({
      apiKey: "test-key",
      baseUrl: "https://api.test.com",
    });

    expect(client).toBeDefined();
    expect(typeof client.GET).toBe("function");
    expect(typeof client.POST).toBe("function");
  });
});

describe("unwrapResult", () => {
  it("returns Ok with data on success", () => {
    const data = { id: "abc" };
    const result = unwrapResult({
      data,
      error: undefined,
      response: new Response(),
    });
    expect(result).toEqual(ok(data));
  });

  it("returns Err with PrintrApiError when error is present", () => {
    const result = unwrapResult({
      data: undefined,
      error: { error: { code: "NOT_FOUND", message: "Token not found" } },
      response: new Response(null, { status: 404 }),
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(PrintrApiError);
  });

  it("includes status code in error", () => {
    const result = unwrapResult({
      data: undefined,
      error: { error: { code: "NOT_FOUND", message: "Token not found" } },
      response: new Response(null, { status: 404 }),
    });
    expect(result._unsafeUnwrapErr().status).toBe(404);
  });

  it("returns Err when data is undefined even without error", () => {
    const result = unwrapResult({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 500 }),
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(PrintrApiError);
  });
});

describe("toToolResponse", () => {
  it("returns structuredContent and text content on Ok", () => {
    const data = { id: "abc", name: "Test" };
    const response = toToolResponse(ok(data));
    expect(response).toEqual({
      structuredContent: data,
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    });
  });

  it("returns isError response on Err", () => {
    const error = new PrintrApiError(404, "Not found");
    const response = toToolResponse(err(error));
    expect(response).toEqual({
      content: [{ type: "text", text: error.message }],
      isError: true,
    });
  });
});
