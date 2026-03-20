import { z } from "zod";

/**
 * Parse RPC_URLS from a JSON-like string to a Record<string, string>.
 * Supports single quotes for easier config: {'base': 'https://...', 'solana': 'https://...'}
 */
export const rpcUrlsSchema = z
  .string()
  .optional()
  .transform((val) => {
    if (!val) {
      return {} as Record<string, string>;
    }
    try {
      // Convert single quotes to double quotes for JSON.parse compatibility
      const normalized = val.replace(/'/g, '"');
      const parsed = JSON.parse(normalized);
      if (typeof parsed !== "object" || parsed === null) {
        return {};
      }
      return parsed as Record<string, string>;
    } catch {
      return {};
    }
  });

/** Alchemy RPC URL templates for supported chains (chain name → URL with {key} placeholder) */
export const ALCHEMY_RPC_TEMPLATES: Record<string, string> = {
  ethereum: "https://eth-mainnet.g.alchemy.com/v2/{key}",
  bnb: "https://bnb-mainnet.g.alchemy.com/v2/{key}",
  unichain: "https://unichain-mainnet.g.alchemy.com/v2/{key}",
  hyperevm: "https://hyperliquid-mainnet.g.alchemy.com/v2/{key}",
  mantle: "https://mantle-mainnet.g.alchemy.com/v2/{key}",
  base: "https://base-mainnet.g.alchemy.com/v2/{key}",
  arbitrum: "https://arb-mainnet.g.alchemy.com/v2/{key}",
  avalanche: "https://avax-mainnet.g.alchemy.com/v2/{key}",
  solana: "https://solana-mainnet.g.alchemy.com/v2/{key}",
};

const schema = z.object({
  PRINTR_API_KEY: z
    .string()
    .default(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhaS1pbnRlZ3JhdGlvbiJ9.PZsqfleSmSiAra8jiN3JZvDSonoawQLnvYRyPHDbtRg",
    ),
  PRINTR_API_BASE_URL: z.string().default("https://api-preview.printr.money"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_IMAGE_MODEL: z.string().default("google/gemini-2.5-flash-image"),
  EVM_WALLET_PRIVATE_KEY: z.string().optional(),
  SVM_WALLET_PRIVATE_KEY: z.string().optional(),
  /** Alchemy API key - automatically provides RPCs for supported chains */
  ALCHEMY_API_KEY: z.string().optional(),
  /** JSON map of chain names to custom RPC URLs (overrides Alchemy), e.g. {'base': 'https://...'} */
  RPC_URLS: rpcUrlsSchema,
  AGENT_MODE: z.string().optional(),
  /** Directory for wallet data (wallets.json, state.json). Defaults to ~/.printr */
  PRINTR_WALLET_STORE: z.string().optional(),
  /** Master password for encrypting deployment wallet private keys */
  PRINTR_DEPLOYMENT_PASSWORD: z.string().optional(),
  /** Backend gRPC API URL for fee claiming */
  PRINTR_BACKEND_URL: z.string().default("https://api.printr.money"),
  // dev only
  PRINTR_APP_URL: z.string().default("https://app.printr.money"),
  PRINTR_CDN_URL: z.string().default("https://cdn.printr.money"),
  VERBOSE: z.string().optional(),
  // logging
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  LOG_FORMAT: z.enum(["json", "pretty"]).default("json"),
  // e2e only
  PRINTR_TEST_TOKEN_ID: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);
