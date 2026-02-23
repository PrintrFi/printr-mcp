import { errAsync, okAsync } from "neverthrow";
import type { PrintrClient, paths } from "~/lib/client.js";
import { unwrapResultAsync } from "~/lib/client.js";
import { env } from "~/lib/env.js";
import { generateTokenImage, processImagePath } from "~/lib/image.js";

type CreateTokenRequestBody =
  paths["/print"]["post"]["requestBody"]["content"]["application/json"];

export type BuildTokenInput = {
  creator_accounts: string[];
  name: string;
  symbol: string;
  description: string;
  image?: string;
  image_path?: string;
  chains: string[];
  initial_buy: { supply_percent?: number; spend_usd?: number; spend_native?: string };
  graduation_threshold_per_chain_usd?: 69000 | 250000;
  external_links?: { website?: string; x?: string; telegram?: string; github?: string };
};

/**
 * Resolves the image and calls POST /print.
 * Used by both `printr_create_token` and `printr_launch_token`.
 */
export function buildToken({ image, image_path, ...rest }: BuildTokenInput, client: PrintrClient) {
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
    ),
  );
}
