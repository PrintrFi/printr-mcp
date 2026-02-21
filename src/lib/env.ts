import { z } from "zod";

const schema = z.object({
  PRINTR_API_KEY: z.string().optional(),
  PRINTR_API_BASE_URL: z.string().default("https://api-preview.printr.money"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_IMAGE_MODEL: z.string().default("google/gemini-2.5-flash-image"),
  EVM_WALLET_PRIVATE_KEY: z.string().optional(),
  SVM_WALLET_PRIVATE_KEY: z.string().optional(),
  AGENT_MODE: z.string().optional(),
  PRINTR_WALLET_STORE: z.string().optional(),
  // dev only
  PRINTR_APP_URL: z.string().default("https://app.printr.money"),
  VERBOSE: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);
