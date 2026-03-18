/**
 * @printr/sdk basic usage example
 *
 * Demonstrates:
 * - Creating a Printr client
 * - Getting a quote for token creation
 * - Fetching token details
 * - Checking deployments
 * - Listing supported chains
 *
 * Run: bun examples/sdk-basic/index.ts
 */

import {
  createPrintrClient,
  unwrapResult,
  CHAIN_META,
  env,
} from "@printr/sdk";

const KNOWN_TOKEN_ID =
  "0x92a1814fd6f5315f3ac4f7b492afa80d427a202a5411eda2964cbf590be93ef2";

async function main() {
  console.log("=== @printr/sdk Basic Example ===\n");

  // Create client
  const client = createPrintrClient({
    apiKey: env.PRINTR_API_KEY,
    baseUrl: env.PRINTR_API_BASE_URL,
  });

  // 1. List supported chains
  console.log("1. Supported Chains:");
  const chains = Object.entries(CHAIN_META)
    .map(([id, meta]) => `   ${meta.name} (${id})`)
    .join("\n");
  console.log(chains);
  console.log();

  // 2. Get a quote for token creation
  console.log("2. Quote for Base deployment ($10 initial buy):");
  const quoteResponse = await client.POST("/print/quote", {
    body: {
      chains: ["eip155:8453"],
      initial_buy: { spend_usd: 10 },
    },
  });
  const quoteResult = unwrapResult(quoteResponse);

  if (quoteResult.isOk()) {
    const quote = quoteResult.value.quote;
    console.log(`   Quote ID: ${quote.id}`);
    console.log(`   Total cost: $${quote.total.cost_usd.toFixed(2)}`);
    console.log(`   Router: ${quote.router}`);
  } else {
    console.log(`   Error: ${quoteResult.error.message}`);
  }
  console.log();

  // 3. Fetch token details
  console.log(`3. Token Details (${KNOWN_TOKEN_ID.slice(0, 10)}...):`);
  const tokenResponse = await client.GET("/tokens/{id}", {
    params: { path: { id: KNOWN_TOKEN_ID } },
  });
  const tokenResult = unwrapResult(tokenResponse);

  if (tokenResult.isOk()) {
    const token = tokenResult.value;
    console.log(`   Name: ${token.name}`);
    console.log(`   Symbol: ${token.symbol}`);
    console.log(`   Description: ${token.description}`);
    console.log(`   Chains: ${token.chains.join(", ")}`);
  } else {
    console.log(`   Error: ${tokenResult.error.message}`);
  }
  console.log();

  // 4. Check deployments
  console.log("4. Deployment Status:");
  const deploymentsResponse = await client.GET("/tokens/{id}/deployments", {
    params: { path: { id: KNOWN_TOKEN_ID } },
  });
  const deploymentsResult = unwrapResult(deploymentsResponse);

  if (deploymentsResult.isOk()) {
    for (const d of deploymentsResult.value.deployments) {
      console.log(`   ${d.chain_id}: ${d.status} @ ${d.contract_address.slice(0, 10)}...`);
    }
  } else {
    console.log(`   Error: ${deploymentsResult.error.message}`);
  }
  console.log();

  console.log("=== All checks passed ===");
}

main().catch(console.error);
