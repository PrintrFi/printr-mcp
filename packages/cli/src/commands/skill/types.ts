export type StepStatus = "running" | "ok" | "warn" | "error" | "skip";

export type StepResult = {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
};
