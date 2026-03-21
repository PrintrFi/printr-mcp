import { errAsync, okAsync } from "neverthrow";
import type { PrintrClient, paths } from "./client.js";
import { unwrapResultAsync } from "./client.js";
import { env } from "./env.js";
import { ensureHex } from "./hex.js";
import { generateTokenImage, processImagePath } from "./image.js";

type CreateTokenRequestBody = paths["/print"]["post"]["requestBody"]["content"]["application/json"];

export type BuildTokenInput = {
  creator_accounts?: string[] | undefined;
  name: string;
  symbol: string;
  description: string;
  image?: string | undefined;
  image_path?: string | undefined;
  chains: string[];
  initial_buy: {
    supply_percent?: number | undefined;
    spend_usd?: number | undefined;
    spend_native?: string | undefined;
  };
  graduation_threshold_per_chain_usd?: 69000 | 250000 | undefined;
  external_links?:
    | {
        website?: string | undefined;
        x?: string | undefined;
        telegram?: string | undefined;
        github?: string | undefined;
      }
    | undefined;
};

/**
 * Resolves the image and calls POST /print.
 * Used by both `printr_create_token` and `printr_launch_token`.
 */
export function buildToken({ image, image_path, ...rest }: BuildTokenInput, client: PrintrClient) {
  if (!rest.creator_accounts) {
    return errAsync({
      message: "creator_accounts is required. Provide at least one CAIP-10 address per chain.",
    });
  }

  const imageAsync = image
    ? okAsync(image)
    : image_path
      ? processImagePath(image_path)
      : env.OPENROUTER_API_KEY
        ? generateTokenImage({
            name: rest.name,
            symbol: rest.symbol,
            description: rest.description,
            openrouterApiKey: env.OPENROUTER_API_KEY,
          })
        : errAsync({
            message:
              "No image provided. Supply image, image_path, or configure OPENROUTER_API_KEY for auto-generation.",
          });

  return imageAsync.andThen((resolvedImage) =>
    unwrapResultAsync(
      client.POST("/print", {
        body: { ...rest, image: resolvedImage } as CreateTokenRequestBody,
      }),
    ).map((response) => {
      // Normalize EVM payload fields to 0x-prefixed hex
      if (response.payload && "calldata" in response.payload) {
        const payload = response.payload as { calldata: string };
        if (payload.calldata) {
          payload.calldata = ensureHex(payload.calldata);
        }
      }

      if (response.payload?.hash) {
        response.payload.hash = ensureHex(response.payload.hash);
      }

      return response;
    }),
  );
}
