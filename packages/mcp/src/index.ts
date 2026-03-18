#!/usr/bin/env node

export { startMcpServer } from "./mcp.js";

// If run directly (not imported), start the server
if (import.meta.main) {
  const { startMcpServer } = await import("./mcp.js");
  await startMcpServer();
}
