import { type ToolResponse, toToolResponseAsync } from "@printr/sdk";
import type { ResultAsync } from "neverthrow";
import { logToolExecution } from "~/lib/logging.js";

/** Per-request bundle handed to every tool handler — input + dependency record. */
export type HandlerCtx<I, D> = {
  input: I;
  deps: D;
};

/** A typed tool handler. Returns a `ResultAsync`; the HOF lifts it to `ToolResponse`. */
export type DepsHandler<I, D, T, E extends { message: string }> = (
  ctx: HandlerCtx<I, D>,
) => ResultAsync<T, E>;

/**
 * Lift a `DepsHandler` into the `(input) => Promise<ToolResponse>` shape
 * `server.registerTool` expects. Wraps `logToolExecution` plus
 * `toToolResponseAsync` so each handler body returns a raw `ResultAsync`
 * instead of repeating the projection.
 *
 * Mirrors the `handler` HOF in `~/dev/printr-bot/src/commands/handler.ts`.
 */
export const handler =
  <I, D, T, E extends { message: string }>(toolName: string, fn: DepsHandler<I, D, T, E>) =>
  (deps: D): ((input: I) => Promise<ToolResponse<Record<string, unknown>>>) =>
    logToolExecution(
      toolName,
      (input: I): Promise<ToolResponse<Record<string, unknown>>> =>
        toToolResponseAsync(fn({ input, deps })) as Promise<ToolResponse<Record<string, unknown>>>,
    );
