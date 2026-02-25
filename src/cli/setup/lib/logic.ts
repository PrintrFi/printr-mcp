import type { ClientDef, ConfigureResult, McpEntry, Runtime, StepResult } from "../types.js";
import { parseSetupArgs } from "./args.js";
import { CLIENTS, detectRuntime, makeEntry, RESULT_DETAIL, RESULT_STATUS } from "./clients.js";

export function processClient(
  client: ClientDef,
  entry: McpEntry,
  runtime: Runtime,
): Omit<StepResult, "id" | "label"> {
  if (!client.detect()) return { status: "skip" };
  let result: ConfigureResult;
  try {
    result = client.configure(entry, runtime);
  } catch {
    result = "failed";
  }
  return { status: RESULT_STATUS[result], detail: RESULT_DETAIL[result] };
}

export async function runSetupLogic(
  args: string[],
  onStep: (step: StepResult) => void,
): Promise<number> {
  const { targetIds, openrouterApiKey } = parseSetupArgs(args);
  const runtime = detectRuntime();
  const entry = makeEntry(runtime, openrouterApiKey);
  const clients = CLIENTS.filter((c) => targetIds.includes(c.id));
  let configured = 0;

  for (const client of clients) {
    onStep({ id: client.id, label: client.label, status: "running" });
    const { status, detail } = processClient(client, entry, runtime);
    onStep({ id: client.id, label: client.label, status, detail });
    if (status === "ok") configured++;
  }

  return configured;
}
