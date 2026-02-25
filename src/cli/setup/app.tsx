/** @jsxImportSource react */

import { Box, Static, useApp } from "ink";
import { useEffect, useState } from "react";
import { Banner } from "./components/banner.js";
import { SelectionScreen } from "./components/selection.js";
import { StepRow } from "./components/step-row.js";
import { Summary } from "./components/summary.js";
import { CLIENTS } from "./lib/clients.js";
import { runSetupLogic } from "./lib/logic.js";
import type { StepResult } from "./types.js";

type Phase = "selecting" | "running" | "done";

export function SetupApp({
  preselectedIds,
  openrouterApiKey,
}: {
  preselectedIds: string[] | null;
  openrouterApiKey: string;
}) {
  const { exit } = useApp();

  // Detect which clients are installed once on mount (synchronous fs/process checks).
  const [detectedIds] = useState<Set<string>>(
    () => new Set(CLIENTS.filter((c) => c.detect()).map((c) => c.id)),
  );

  const [phase, setPhase] = useState<Phase>(preselectedIds !== null ? "running" : "selecting");
  const [selectedIds, setSelectedIds] = useState<string[]>(preselectedIds ?? []);
  const [completedSteps, setCompletedSteps] = useState<StepResult[]>([]);
  const [currentStep, setCurrentStep] = useState<StepResult | null>(null);
  const [configured, setConfigured] = useState<number | null>(null);

  useEffect(() => {
    if (phase !== "running") return;
    runSetupLogic(selectedIds, openrouterApiKey, (step) => {
      if (step.status === "running") {
        setCurrentStep(step);
      } else {
        setCurrentStep(null);
        setCompletedSteps((prev) => [...prev, step]);
      }
    }).then((n) => {
      setConfigured(n);
      setPhase("done");
    });
  }, [phase, selectedIds, openrouterApiKey]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: exit is stable
  useEffect(() => {
    if (configured !== null) exit();
  }, [configured]);

  function handleConfirm(ids: string[]) {
    setSelectedIds(ids);
    setPhase("running");
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Banner />
      {phase === "selecting" && (
        <SelectionScreen clients={CLIENTS} detectedIds={detectedIds} onConfirm={handleConfirm} />
      )}
      {phase !== "selecting" && (
        <Box flexDirection="column" paddingLeft={2}>
          <Static items={completedSteps}>{(step) => <StepRow key={step.id} step={step} />}</Static>
          {currentStep && <StepRow step={currentStep} />}
        </Box>
      )}
      {configured !== null && <Summary configured={configured} />}
    </Box>
  );
}
