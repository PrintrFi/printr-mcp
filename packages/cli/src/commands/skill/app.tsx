import { Box, Static, useApp } from "ink";
import { useEffect, useState } from "react";
import { Banner } from "./components/banner.js";
import { SelectionScreen } from "./components/selection.js";
import { StepRow } from "./components/step-row.js";
import { Summary } from "./components/summary.js";
import { AGENTS } from "./lib/agents.js";
import { runSkillInstall } from "./lib/logic.js";
import type { StepResult } from "./types.js";

type Phase = "selecting" | "running" | "done";

export function SkillApp({ preselectedIds }: { preselectedIds: string[] | null }) {
  const { exit } = useApp();

  const [detectedIds] = useState<Set<string>>(
    () => new Set(AGENTS.filter((a) => a.detect()).map((a) => a.id)),
  );

  const [phase, setPhase] = useState<Phase>(preselectedIds !== null ? "running" : "selecting");
  const [selectedIds, setSelectedIds] = useState<string[]>(preselectedIds ?? []);
  const [completedSteps, setCompletedSteps] = useState<StepResult[]>([]);
  const [currentStep, setCurrentStep] = useState<StepResult | null>(null);
  const [installed, setInstalled] = useState<number | null>(null);

  useEffect(() => {
    if (phase !== "running") {
      return;
    }
    runSkillInstall(selectedIds, (step) => {
      if (step.status === "running") {
        setCurrentStep(step);
      } else {
        setCurrentStep(null);
        setCompletedSteps((prev) => [...prev, step]);
      }
    }).then((n) => {
      setInstalled(n);
      setPhase("done");
    });
  }, [phase, selectedIds]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: exit is stable
  useEffect(() => {
    if (installed !== null) {
      exit();
    }
  }, [installed]);

  function handleConfirm(ids: string[]) {
    setSelectedIds(ids);
    setPhase("running");
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Banner />
      {phase === "selecting" && (
        <SelectionScreen agents={AGENTS} detectedIds={detectedIds} onConfirm={handleConfirm} />
      )}
      {phase !== "selecting" && (
        <Box flexDirection="column" paddingLeft={2}>
          <Static items={completedSteps}>{(step) => <StepRow key={step.id} step={step} />}</Static>
          {currentStep && <StepRow step={currentStep} />}
        </Box>
      )}
      {installed !== null && <Summary installed={installed} />}
    </Box>
  );
}
