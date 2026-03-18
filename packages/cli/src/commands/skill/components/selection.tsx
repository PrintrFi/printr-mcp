import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { AgentDef } from "../lib/agents.js";

export function SelectionScreen({
  agents,
  detectedIds,
  onConfirm,
}: {
  agents: AgentDef[];
  detectedIds: Set<string>;
  onConfirm: (ids: string[]) => void;
}) {
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set(detectedIds));

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((c) => (c - 1 + agents.length) % agents.length);
    } else if (key.downArrow) {
      setCursor((c) => (c + 1) % agents.length);
    } else if (input === " ") {
      const id = agents[cursor]!.id;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else if (key.return) {
      onConfirm([...selected]);
    }
  });

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text dimColor>↑↓ move · space toggle · enter confirm</Text>
      <Box flexDirection="column" marginTop={1}>
        {agents.map((a, i) => {
          const isDetected = detectedIds.has(a.id);
          const isSelected = selected.has(a.id);
          const isCursor = i === cursor;
          return (
            <Box key={a.id}>
              <Text color={isCursor ? "cyan" : undefined}>
                {isCursor ? "›" : " "}
                {"  "}
              </Text>
              <Text color={isSelected ? "green" : undefined}>
                {isSelected ? "◉" : "○"}
                {"  "}
              </Text>
              <Text dimColor={!isDetected}>{a.label}</Text>
              {!isDetected && <Text dimColor> — not detected</Text>}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
