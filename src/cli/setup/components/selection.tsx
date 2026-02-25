/** @jsxImportSource react */

import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { ClientDef } from "../types.js";

export function SelectionScreen({
  clients,
  detectedIds,
  onConfirm,
}: {
  clients: ClientDef[];
  detectedIds: Set<string>;
  onConfirm: (ids: string[]) => void;
}) {
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set(detectedIds));

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((c) => (c - 1 + clients.length) % clients.length);
    } else if (key.downArrow) {
      setCursor((c) => (c + 1) % clients.length);
    } else if (input === " ") {
      const id = clients[cursor]!.id;
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
        {clients.map((c, i) => {
          const isDetected = detectedIds.has(c.id);
          const isSelected = selected.has(c.id);
          const isCursor = i === cursor;
          return (
            <Box key={c.id}>
              <Text color={isCursor ? "cyan" : undefined}>
                {isCursor ? "›" : " "}
                {"  "}
              </Text>
              <Text color={isSelected ? "green" : undefined}>
                {isSelected ? "◉" : "○"}
                {"  "}
              </Text>
              <Text dimColor={!isDetected}>{c.label}</Text>
              {!isDetected && <Text dimColor> — not detected</Text>}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
