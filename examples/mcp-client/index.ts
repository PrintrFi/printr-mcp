/**
 * @printr/mcp programmatic client example
 *
 * Demonstrates connecting to the MCP server programmatically
 * and calling tools directly - useful for testing and automation.
 *
 * Run: bun examples/mcp-client/index.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  console.log("=== @printr/mcp Client Example ===\n");

  // Connect to MCP server via stdio
  // Run the built MCP server directly from workspace
  console.log("1. Starting MCP server...");

  // Resolve path relative to repo root (2 levels up from examples/mcp-client)
  const repoRoot = new URL("../../", import.meta.url).pathname;
  const mcpPath = `${repoRoot}packages/mcp/dist/index.js`;

  const transport = new StdioClientTransport({
    command: "bun",
    args: ["run", mcpPath],
    env: {
      ...process.env,
      LOG_LEVEL: "error", // Suppress info logs
    },
  });

  const client = new Client(
    { name: "example-client", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log("   Connected!\n");

    // 2. List available tools
    console.log("2. Available Tools:");
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name).sort();
    console.log(`   Found ${toolNames.length} tools:`);
    for (const name of toolNames.slice(0, 10)) {
      console.log(`   - ${name}`);
    }
    if (toolNames.length > 10) {
      console.log(`   ... and ${toolNames.length - 10} more`);
    }
    console.log();

    // 3. Call printr_supported_chains
    console.log("3. Calling printr_supported_chains:");
    const chainsResult = await client.callTool({
      name: "printr_supported_chains",
      arguments: {},
    });
    const chainsContent = chainsResult.content as Array<{ type: string; text: string }>;
    if (chainsContent[0]?.type === "text") {
      const chains = JSON.parse(chainsContent[0].text);
      console.log(`   Found ${chains.chains.length} supported chains`);
      for (const chain of chains.chains.slice(0, 5)) {
        console.log(`   - ${chain.name} (${chain.chain_id})`);
      }
    }
    console.log();

    // 4. Call printr_quote
    console.log("4. Calling printr_quote (Base, $10 spend):");
    const quoteResult = await client.callTool({
      name: "printr_quote",
      arguments: {
        chains: ["eip155:8453"],
        initial_buy: { spend_usd: 10 },
      },
    });
    const quoteContent = quoteResult.content as Array<{ type: string; text: string }>;
    if (quoteContent[0]?.type === "text") {
      const quote = JSON.parse(quoteContent[0].text);
      console.log(`   Quote ID: ${quote.id}`);
      console.log(`   Total: $${quote.total.cost_usd.toFixed(2)}`);
    }
    console.log();

    // 5. Call printr_get_token
    // Example telecoin ID in the documented hex format. It may not exist in
    // every environment; the call reports a missing token gracefully rather
    // than failing the example.
    const tokenId =
      "0x10f55a83f704819160fd589ddb6ea581b43dc513bd287a85c0e586c7e40ced1f";
    console.log(`5. Calling printr_get_token (${tokenId.slice(0, 12)}...):`);
    const tokenResult = await client.callTool({
      name: "printr_get_token",
      arguments: { id: tokenId },
    });
    const tokenContent = tokenResult.content as Array<{ type: string; text: string }>;
    const tokenText = tokenContent[0]?.text ?? "";
    if (tokenResult.isError) {
      console.log(`   Token unavailable: ${tokenText.trim()}`);
    } else {
      const token = JSON.parse(tokenText);
      console.log(`   Name: ${token.name}`);
      console.log(`   Symbol: ${token.symbol}`);
      console.log(`   Chains: ${token.chains.join(", ")}`);
    }
    console.log();

    console.log("=== All checks passed ===");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
