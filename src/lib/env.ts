import { z } from "zod";

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
  SVM_RPC_URL: z.string().optional(),
  AGENT_MODE: z.string().optional(),
  PRINTR_WALLET_STORE: z.string().optional(),
  // dev only
  PRINTR_APP_URL: z.string().default("https://app.printr.money"),
  PRINTR_CDN_URL: z.string().default("https://cdn.printr.money"),
  VERBOSE: z.string().optional(),
  // e2e only
  PRINTR_TEST_TOKEN_ID: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);
