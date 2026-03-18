import { Box, Text } from "ink";

export function Banner() {
  return (
    <Box marginBottom={1}>
      <Text bold>{"  Printr MCP  "}</Text>
      <Text dimColor>{"— launch tokens from any AI client"}</Text>
    </Box>
  );
}
