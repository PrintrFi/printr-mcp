import { z } from "zod";

export const caip2ChainId = z
  .string()
  .describe(
    "CAIP-2 chain ID (e.g. 'eip155:8453' for Base, " +
      "'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' for Solana)",
  );

export const caip10Address = z.string().describe("CAIP-10 address (e.g. 'eip155:8453:0x742d...')");

export const tokenId = z
  .string()
  .describe(
    "Telecoin ID (hex, e.g. '0x3a7a8d...') or CAIP-10 address " + "(e.g. 'eip155:8453:0x742d...')",
  );

export const initialBuy = z
  .object({
    supply_percent: z
      .number()
      .min(0.01)
      .max(69)
      .optional()
      .describe("Buy a percentage of total supply (0.01–69%)"),
    spend_usd: z.number().positive().optional().describe("Spend a fixed USD amount"),
    spend_native: z.string().optional().describe("Spend a native token amount (atomic units)"),
  })
  .refine(
    (v) =>
      [v.supply_percent, v.spend_usd, v.spend_native].filter((x) => x !== undefined).length === 1,
    { message: "Exactly one of supply_percent, spend_usd, or spend_native" },
  );

export const graduationThreshold = z
  .union([z.literal(69000), z.literal(250000)])
  .optional()
  .describe("Graduation threshold in USD (default: 69000)");

export const externalLinks = z
  .object({
    website: z.url().optional(),
    x: z.url().optional(),
    telegram: z.url().optional(),
    github: z.url().optional(),
  })
  .optional()
  .describe("Optional external links for the token");

export const cost = z.object({
  asset_id: z.string().describe("CAIP-10 reference asset"),
  cost_usd: z.number().describe("Cost in USD"),
  cost_asset_atomic: z.string().describe("Cost in atomic units of the reference asset"),
  description: z.string().optional().describe("Cost label (e.g. 'Gas', 'X-Chain Fee')"),
  limit: z.number().optional().describe("Upper bound spending limit"),
});

export const asset = z.object({
  id: z.string().describe("CAIP-10 asset identifier"),
  name: z.string().describe("Display name"),
  symbol: z.string().describe("Ticker symbol"),
  decimals: z.number().describe("Decimal precision"),
  price_usd: z.number().describe("USD price estimate"),
});

/** Shared between printr_quote output and printr_create_token output */
export const quoteOutput = z.object({
  id: z.string().describe("Quote identifier"),
  router: z.string().describe("Routing provider type"),
  assets: z.array(asset).describe("Involved assets"),
  initial_buy_amount: z.string().optional().describe("Token amount from initial buy"),
  costs: z.array(cost).describe("Itemized cost breakdown"),
  total: cost.describe("Aggregated total cost"),
});
