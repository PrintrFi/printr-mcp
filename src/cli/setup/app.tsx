/** @jsxImportSource react */

import { Box, Static, useApp } from "ink";
import { useEffect, useState } from "react";
import { Banner } from "./components/banner.js";
import { StepRow } from "./components/step-row.js";
import { Summary } from "./components/summary.js";
import { runSetupLogic } from "./lib/logic.js";
import type { StepResult } from "./types.js";

export function SetupApp({ args }: { args: string[] }) {
  const { exit } = useApp();
  const [completedSteps, setCompletedSteps] = useState<StepResult[]>([]);
  const [currentStep, setCurrentStep] = useState<StepResult | null>(null);
  const [configured, setConfigured] = useState<number | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs once on mount
  useEffect(() => {
    runSetupLogic(args, (step) => {
      if (step.status === "running") {
        setCurrentStep(step);
      } else {
        setCurrentStep(null);
        setCompletedSteps((prev) => [...prev, step]);
      }
    }).then(setConfigured);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: exit is stable
  useEffect(() => {
    if (configured !== null) exit();
  }, [configured]);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Banner />
      <Box flexDirection="column" paddingLeft={2}>
        <Static items={completedSteps}>{(step) => <StepRow key={step.id} step={step} />}</Static>
        {currentStep && <StepRow step={currentStep} />}
      </Box>
      {configured !== null && <Summary configured={configured} />}
    </Box>
  );
}
