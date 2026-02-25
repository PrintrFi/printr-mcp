/** @jsxImportSource react */

import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { StepResult, StepStatus } from "../types.js";

const ICONS: Record<StepStatus, string> = {
  running: "…",
  ok: "✓",
  warn: "!",
  skip: "–",
  error: "✗",
};

const COLORS: Record<StepStatus, string | undefined> = {
  running: "cyan",
  ok: "green",
  warn: "yellow",
  skip: undefined,
  error: "red",
};

export function StepRow({ step }: { step: StepResult }) {
  if (step.status === "running") {
    return (
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text>
          {"  "}
          {step.label}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color={COLORS[step.status]}>{ICONS[step.status]}</Text>
      <Text dimColor={step.status === "skip"}>
        {"  "}
        {step.label}
      </Text>
      {step.detail && (
        <Text dimColor>
          {"  — "}
          {step.detail}
        </Text>
      )}
    </Box>
  );
}
