#!/usr/bin/env node

import { version } from "../package.json";

export { startMcpServer } from "./mcp.js";

function printHelp(): void {
  process.stdout.write(
    [
      "Printr MCP Server",
      "",
      "Usage:",
      "  printr-mcp [options]",
      "",
      "Options:",
      "  -h, --help       Show this help message",
      "  -v, --version    Print the package version",
      "",
      "When no metadata flag is provided, the server starts on stdio for MCP clients.",
      "",
    ].join("\n"),
  );
}

function handleCliMetadataFlags(argv: string[]): void {
  const args = argv.slice(2);

  if (args.includes("--version") || args.includes("-v")) {
    process.stdout.write(`${version}\n`);
    process.exit(0);
  }

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }
}

// If run directly (not imported), start the server
if (import.meta.main) {
  handleCliMetadataFlags(process.argv);

  const { startMcpServer } = await import("./mcp.js");
  await startMcpServer();
}
