import { z } from "zod";

const schema = z.object({
  PRINTR_API_KEY: z.string().optional(),
  PRINTR_API_BASE_URL: z.string().default("https://api-preview.printr.money"),
  PRINTR_APP_URL: z.string().default("https://app.printr.money"),
  PRINTR_TEST_TOKEN_ID: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_IMAGE_MODEL: z.string().default("gemini/gemini-2.5-flash-image"),
  EVM_WALLET_PRIVATE_KEY: z.string().optional(),
  SVM_WALLET_PRIVATE_KEY: z.string().optional(),
  VERBOSE: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);
