export type Runtime = "bun" | "node";
export type StepStatus = "running" | "ok" | "warn" | "skip" | "error";

export interface StepResult {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

export interface McpEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export type ConfigureResult = "configured" | "already_configured" | "not_detected" | "failed";

export interface ClientDef {
  id: string;
  label: string;
  detect(): boolean;
  configure(entry: McpEntry, runtime: Runtime): ConfigureResult;
}
