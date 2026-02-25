import { err, ok, type Result, ResultAsync } from "neverthrow";
import createClient from "openapi-fetch";

import type { paths } from "~/api.gen.js";

export type { paths };
export type PrintrClient = ReturnType<typeof createPrintrClient>;

export interface ClientConfig {
  apiKey: string;
  baseUrl: string;
}

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
 * Creates a typed HTTP client for the Printr API with authentication.
 *
 * @example
 * ```ts
 * const client = createPrintrClient({
 *   apiKey: process.env.PRINTR_API_KEY,
 *   baseUrl: "https://api-preview.printr.money"
 * });
 * ```
 */
export function createPrintrClient(config: ClientConfig) {
  return createClient<paths>({
    baseUrl: `${config.baseUrl}/v0`,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });
}

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
export function unwrapResult<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): Result<T, PrintrApiError> {
  if (result.error !== undefined || result.data === undefined) {
    return err(
      new PrintrApiError(
        result.response.status,
        typeof result.error === "object"
          ? JSON.stringify(result.error)
          : String(result.error ?? result.response.statusText),
      ),
    );
  }
  return ok(result.data);
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
  promise: Promise<{
    data?: T;
    error?: unknown;
    response: Response;
  }>,
): ResultAsync<T, PrintrApiError> {
  return ResultAsync.fromPromise(
    promise,
    (e) => new PrintrApiError(0, e instanceof Error ? e.message : String(e)),
  ).andThen(unwrapResult);
}

/** Error type with a message (PrintrApiError, ImageError, etc.) for tool responses. */
type ErrorWithMessage = { message: string };

/**
 * Converts a ResultAsync into a Promise of the MCP tool response. Use this in
 * tool handlers so the pipeline stays ResultAsync instead of async/await + Result.
 */
export type ToolResponse<T> =
  | { structuredContent: T; content: { type: "text"; text: string }[] }
  | { content: { type: "text"; text: string }[]; isError: true };

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
