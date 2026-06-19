import { err, ok, type Result, ResultAsync } from "neverthrow";
import createClient from "openapi-fetch";

import type { paths } from "./api.gen.js";

export type { paths };
export type PrintrClient = ReturnType<typeof createPrintrClient>;

export interface ClientConfig {
  /**
   * Bearer token for authenticated endpoints. Optional — the public preview API
   * (`https://api-preview.printr.money`, the default base URL) requires no key.
   */
  apiKey?: string;
  baseUrl: string;
}

/**
 * Error returned by Printr API calls.
 * Carries the HTTP status and a sanitised detail string from the response.
 */
export class PrintrApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`Printr API error ${status}: ${detail}`);
    this.name = "PrintrApiError";
  }
}

/**
 * Creates a typed HTTP client for the Printr API.
 *
 * `apiKey` is optional: the public preview API requires no credentials, so the
 * `Authorization` header is only sent when a key is provided.
 *
 * @example
 * ```ts
 * // Keyless against the public preview API:
 * const client = createPrintrClient({
 *   baseUrl: "https://api-preview.printr.money",
 * });
 * ```
 */
export function createPrintrClient(config: ClientConfig) {
  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  return createClient<paths>({
    baseUrl: `${config.baseUrl}/v0`,
    headers,
  });
}

/** The shape of an openapi-fetch response: data on success, error on failure, plus the raw response. */
export type OpenapiResult<T> = {
  data?: T;
  error?: unknown;
  response: Response;
};

/**
 * Converts an openapi-fetch response into a neverthrow Result.
 *
 * @example
 * ```ts
 * const result = unwrapResult(await client.GET("/tokens/{id}"));
 * result.match(
 *   token => console.log(token.name),
 *   error => console.error(error.message)
 * );
 * ```
 */
export function unwrapResult<T>(result: OpenapiResult<T>): Result<T, PrintrApiError> {
  if (result.error !== undefined || result.data === undefined) {
    const detail = extractErrorDetail(result.error, result.response);
    return err(new PrintrApiError(result.response.status, detail));
  }
  return ok(result.data);
}

/** Extract a concise error detail from an API response, sanitising HTML / non-JSON bodies. */
function extractErrorDetail(error: unknown, response: Response): string {
  if (error === undefined || error === null) {
    return response.statusText || "unknown error";
  }

  const raw = typeof error === "object" ? JSON.stringify(error) : String(error);
  const lower = raw.toLowerCase();

  // Detect HTML responses (Cloudflare challenge pages, WAF blocks, etc.)
  if (lower.includes("<!doctype") || lower.includes("<html")) {
    const statusHint =
      response.status === 403
        ? "request blocked by CDN/WAF (Cloudflare)"
        : `unexpected HTML response (${response.status})`;
    return `${statusHint} — the API returned an HTML page instead of JSON. This is likely a transient infrastructure issue; retry after a short delay.`;
  }

  return raw;
}

/**
 * Formats a Result into an MCP tool response with structured content.
 */
export function toToolResponse<T>(result: Result<T, PrintrApiError>) {
  return result.match(
    (data) => ({
      structuredContent: data,
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    }),
    (error) => ({
      content: [{ type: "text" as const, text: error.message }],
      isError: true as const,
    }),
  );
}

/**
 * Converts an openapi-fetch promise into ResultAsync so pipelines stay
 * ResultAsync instead of Promise<Result>.
 */
export function unwrapResultAsync<T>(
  promise: Promise<OpenapiResult<T>>,
): ResultAsync<T, PrintrApiError> {
  return ResultAsync.fromPromise(
    promise,
    (e) => new PrintrApiError(0, e instanceof Error ? e.message : String(e)),
  ).andThen(unwrapResult);
}

/** Error type with a message (PrintrApiError, ImageError, etc.) for tool responses. */
type ErrorWithMessage = { message: string };

/** Discriminated MCP tool response: structured success or text-only error. */
export type ToolResponse<T> =
  | { structuredContent: T; content: { type: "text"; text: string }[] }
  | { content: { type: "text"; text: string }[]; isError: true };

/**
 * Await a {@link ResultAsync} and convert it to an MCP tool response.
 * Use at the tool-handler boundary to keep the pipeline ResultAsync-based.
 */
export async function toToolResponseAsync<T, E extends ErrorWithMessage>(
  resultAsync: ResultAsync<T, E>,
): Promise<ToolResponse<T>> {
  const result = await resultAsync;
  return result.match(
    (data) => ({
      structuredContent: data,
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    }),
    (error) => ({
      content: [{ type: "text" as const, text: error.message }],
      isError: true as const,
    }),
  );
}

/** Build a successful MCP tool response from a plain data object. */
export function toolOk(data: Record<string, unknown>) {
  return {
    structuredContent: data,
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** Build an error MCP tool response. */
export function toolError(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true as const };
}
