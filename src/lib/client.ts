import { err, ok, type Result } from "neverthrow";
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
