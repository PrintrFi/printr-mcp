import { logger } from "@printr/sdk";

/**
 * Log MCP tool execution with timing and outcome.
 *
 * Automatically redacts sensitive fields like private_key, password, etc.
 *
 * Supports both synchronous and asynchronous handlers.
 *
 * @example
 * ```ts
 * export const handler = logToolExecution("printr_launch_token", async (input) => {
 *   // ... tool logic
 *   return toolOk(result);
 * });
 * ```
 */
export function logToolExecution<TInput, TOutput>(
  toolName: string,
  handler: (input: TInput) => TOutput | Promise<TOutput>,
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput) => {
    const start = Date.now();
    const toolLogger = logger.child({ tool: toolName });

    toolLogger.debug({ input }, "Tool execution started");

    try {
      const result = await Promise.resolve(handler(input));
      const duration_ms = Date.now() - start;

      // Check if result is an error (MCP tools return { isError: true })
      const isError = typeof result === "object" && result !== null && "isError" in result;

      if (isError) {
        toolLogger.warn({ duration_ms }, "Tool execution failed");
      } else {
        toolLogger.info({ duration_ms }, "Tool execution completed");
      }

      return result;
    } catch (error) {
      const duration_ms = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : String(error);

      toolLogger.error(
        {
          error: errorMessage,
          duration_ms,
        },
        "Tool execution threw exception",
      );

      throw error;
    }
  };
}
