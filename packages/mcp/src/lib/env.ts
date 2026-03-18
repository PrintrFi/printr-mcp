/**
 * MCP-specific environment configuration.
 * Extends the SDK env with MCP-specific variables.
 */

import { ALCHEMY_RPC_TEMPLATES, rpcUrlsSchema, env as sdkEnv } from "@printr/sdk";
import { z } from "zod";

// Re-export SDK env utilities
export { ALCHEMY_RPC_TEMPLATES, rpcUrlsSchema };

const mcpSchema = z.object({
  // Inherit all SDK env vars
  PRINTR_API_KEY: z.string(),
  PRINTR_API_BASE_URL: z.string(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_IMAGE_MODEL: z.string(),
  ALCHEMY_API_KEY: z.string().optional(),
  RPC_URLS: z.record(z.string(), z.string()),
  PRINTR_WALLET_STORE: z.string().optional(),
  PRINTR_BACKEND_URL: z.string(),

  // MCP-specific env vars
  EVM_WALLET_PRIVATE_KEY: z.string().optional(),
  SVM_WALLET_PRIVATE_KEY: z.string().optional(),
  AGENT_MODE: z.string().optional(),
  /** Master password for encrypting deployment wallet private keys */
  PRINTR_DEPLOYMENT_PASSWORD: z.string().optional(),
  // dev only
  PRINTR_APP_URL: z.string().default("https://app.printr.money"),
  PRINTR_CDN_URL: z.string().default("https://cdn.printr.money"),
  VERBOSE: z.string().optional(),
  // e2e only
  PRINTR_TEST_TOKEN_ID: z.string().optional(),
});

export type Env = z.infer<typeof mcpSchema>;

// Combine SDK env with MCP-specific env vars
export const env: Env = {
  ...sdkEnv,
  EVM_WALLET_PRIVATE_KEY: process.env.EVM_WALLET_PRIVATE_KEY,
  SVM_WALLET_PRIVATE_KEY: process.env.SVM_WALLET_PRIVATE_KEY,
  AGENT_MODE: process.env.AGENT_MODE,
  PRINTR_DEPLOYMENT_PASSWORD: process.env.PRINTR_DEPLOYMENT_PASSWORD,
  PRINTR_APP_URL: process.env.PRINTR_APP_URL ?? "https://app.printr.money",
  PRINTR_CDN_URL: process.env.PRINTR_CDN_URL ?? "https://cdn.printr.money",
  VERBOSE: process.env.VERBOSE,
  PRINTR_TEST_TOKEN_ID: process.env.PRINTR_TEST_TOKEN_ID,
};
