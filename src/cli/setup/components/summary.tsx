/** @jsxImportSource react */

import { Box, Text } from "ink";
import { CLIENTS } from "../lib/clients.js";

export function Summary({ configured }: { configured: number }) {
  const s = configured !== 1 ? "s" : "";

  if (configured === 0) {
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text bold color="yellow">
          Nothing to configure.
        </Text>
        <Text dimColor>No supported clients were detected, or all were already set up.</Text>
        <Text dimColor>Supported: {CLIENTS.map((c) => c.label).join(", ")}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1} paddingLeft={2}>
      <Text bold color="green">
        {"✓ "}Installed for {configured} client{s}.
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text>Restart your client{s} to activate, then try:</Text>
        <Text dimColor>
          {"  "}
          {'"Quote me the cost of creating a token on Base"'}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Docs: </Text>
        <Text color="cyan">https://github.com/PrintrFi/printr-mcp</Text>
      </Box>
    </Box>
  );
}
