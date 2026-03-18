import { Box, Text } from "ink";

export function Summary({ installed }: { installed: number }) {
  if (installed === 0) {
    return (
      <Box paddingTop={1} paddingLeft={2}>
        <Text dimColor>No new skills installed.</Text>
      </Box>
    );
  }
  return (
    <Box paddingTop={1} paddingLeft={2}>
      <Text color="green">
        Installed printr skill to {installed} agent{installed > 1 ? "s" : ""}.
      </Text>
    </Box>
  );
}
