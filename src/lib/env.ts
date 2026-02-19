import { z } from "zod";

const schema = z.object({
  PRINTR_API_KEY: z.string().optional(),
  PRINTR_API_BASE_URL: z.string().default("https://api-preview.printr.money"),
  PRINTR_TEST_TOKEN_ID: z.string().optional(),
  VERBOSE: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);
