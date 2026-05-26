import { toToolResponseAsync } from "@printr/sdk";
import type { ResultAsync } from "neverthrow";
import { logToolExecution } from "~/lib/logging.js";

/** Errors flow through handlers as anything with a `message`. */
export type HandlerError = { message: string };

/** Per-request bundle handed to every tool handler — input + dependency record. */
export type HandlerCtx<I, D> = { input: I; deps: D };

/** A tool handler. Returns a `ResultAsync`; the HOF lifts it to a `ToolResponse`. */
export type DepsHandler<I, D, T> = (ctx: HandlerCtx<I, D>) => ResultAsync<T, HandlerError>;

/**
 * Lift a `DepsHandler` into the shape `server.registerTool` expects.
 * Wraps `logToolExecution` and `toToolResponseAsync` so handler bodies
 * return a raw `ResultAsync` instead of repeating the projection.
 */
export const handler =
  <I, D, T>(name: string, fn: DepsHandler<I, D, T>) =>
  (deps: D) =>
    logToolExecution(name, (input: I) => toToolResponseAsync(fn({ input, deps })));
