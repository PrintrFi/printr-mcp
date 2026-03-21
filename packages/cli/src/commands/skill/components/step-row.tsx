import { Box, Text } from "ink";
import type { StepResult, StepStatus } from "../types.js";

const STATUS_SYMBOLS: Record<StepStatus, string> = {
  running: "◌",
  ok: "✔",
  warn: "●",
  error: "✖",
  skip: "○",
};

const STATUS_COLORS: Record<StepStatus, string | undefined> = {
  running: "cyan",
  ok: "green",
  warn: "yellow",
  error: "red",
  skip: undefined,
};

export function StepRow({ step }: { step: StepResult }) {
  const statusColor = STATUS_COLORS[step.status];
  return (
    <Box>
      {statusColor ? (
        <Text color={statusColor}>{STATUS_SYMBOLS[step.status]} </Text>
      ) : (
        <Text>{STATUS_SYMBOLS[step.status]} </Text>
      )}
      <Text>{step.label}</Text>
      {step.detail && <Text dimColor> — {step.detail}</Text>}
    </Box>
  );
}
