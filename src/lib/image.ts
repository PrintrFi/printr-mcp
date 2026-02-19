import { readFile } from "node:fs/promises";
import { OpenRouter } from "@openrouter/sdk";
import { err, ok, ResultAsync } from "neverthrow";
import sharp from "sharp";
import { env } from "~/lib/env.js";

/** Max base64 size the Printr API accepts (500 KB). */
const MAX_BASE64_BYTES = 500 * 1024;
/** Target output width/height when resizing (longest edge). */
const TARGET_SIZE = 512;
/** JPEG quality used when compressing. */
const JPEG_QUALITY = 80;

export type ImageError = { message: string };

/**
 * Style requirements appended to every image generation prompt to ensure
 * the output is a suitable token avatar.
 */
const TOKEN_AVATAR_REQUIREMENTS =
  "Style: perfectly square 1:1 aspect ratio, bold vibrant cartoon or illustrative art, " +
  "solid or minimally styled background, absolutely no text, letters, numbers, or words " +
  "anywhere in the image, clean icon design that stays recognisable at small sizes, " +
  "high contrast with vivid colours.";

/**
 * Wraps a raw user prompt with token-avatar style requirements.
 */
export function buildImagePrompt(userPrompt: string): string {
  return `${userPrompt} ${TOKEN_AVATAR_REQUIREMENTS}`;
}

/**
 * Builds an image prompt from token metadata (name, symbol, description)
 * and appends the standard avatar requirements.
 */
function buildTokenImagePrompt(name: string, symbol: string, description: string): string {
  return buildImagePrompt(
    `A striking cryptocurrency token logo for "${name}" (ticker: ${symbol}). ${description}`,
  );
}

// ---------------------------------------------------------------------------
// Shared OpenRouter image generation
// ---------------------------------------------------------------------------

export interface GenerateImageOptions {
  openrouterApiKey: string;
  /** OpenRouter model ID. Defaults to env.OPENROUTER_IMAGE_MODEL. */
  model?: string;
}

/**
 * Calls the OpenRouter API with the given prompt and returns a raw base64
 * string (no data-URI prefix). The prompt is used verbatim — callers are
 * responsible for building it via `buildImagePrompt` if needed.
 */
function callOpenRouterForImage(
  prompt: string,
  { openrouterApiKey, model = env.OPENROUTER_IMAGE_MODEL }: GenerateImageOptions,
): ResultAsync<string, ImageError> {
  const client = new OpenRouter({ apiKey: openrouterApiKey });

  return ResultAsync.fromPromise(
    client.chat.send({
      chatGenerationParams: {
        model,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image"],
        stream: false,
      },
    }),
    (e) => ({
      message: `OpenRouter request failed: ${e instanceof Error ? e.message : String(e)}`,
    }),
  )
    .andThen((response) => {
      const images = response.choices?.[0]?.message?.images;
      if (!images?.length) {
        return err({ message: "OpenRouter response contained no image data." });
      }
      const dataUrl = images[0]?.imageUrl?.url;
      if (!dataUrl || typeof dataUrl !== "string") {
        return err({ message: "OpenRouter response contained no image data." });
      }
      // Strip the data URI prefix (e.g. "data:image/png;base64,")
      const i = dataUrl.indexOf(",");
      return ok(i === -1 ? dataUrl : dataUrl.slice(i + 1));
    })
    .andThen((base64) =>
      // Always run through sharp to normalise format (JPEG), dimensions, and
      // file size regardless of what the model returned.
      ResultAsync.fromPromise(
        sharp(Buffer.from(base64, "base64"))
          .resize(TARGET_SIZE, TARGET_SIZE, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: JPEG_QUALITY })
          .toBuffer(),
        (e) => ({ message: `Image optimisation failed: ${String(e)}` }),
      ).map((buf) => buf.toString("base64")),
    );
}

// ---------------------------------------------------------------------------
// Public image generation API
// ---------------------------------------------------------------------------

export interface TokenImageParams extends GenerateImageOptions {
  name: string;
  symbol: string;
  description: string;
}

/**
 * Generates a token avatar from structured token metadata.
 * The prompt is built from the token name, symbol, and description with
 * standard avatar style requirements appended automatically.
 */
export function generateTokenImage(params: TokenImageParams): ResultAsync<string, ImageError> {
  const { name, symbol, description, ...options } = params;
  return callOpenRouterForImage(buildTokenImagePrompt(name, symbol, description), options);
}

/**
 * Generates an image from a raw user-supplied prompt.
 * The standard avatar style requirements are appended to the prompt
 * automatically via `buildImagePrompt`.
 */
export function generateImageFromPrompt(
  userPrompt: string,
  options: GenerateImageOptions,
): ResultAsync<string, ImageError> {
  return callOpenRouterForImage(buildImagePrompt(userPrompt), options);
}

// ---------------------------------------------------------------------------
// Image compression
// ---------------------------------------------------------------------------

/**
 * Compresses a raw image Buffer to a JPEG Buffer that fits within the 500 KB
 * base64 limit. Returns the original buffer unchanged if it already fits.
 */
export function compressImageBuffer(buffer: Buffer): ResultAsync<Buffer, ImageError> {
  const b64Len = Math.ceil((buffer.byteLength / 3) * 4);
  if (b64Len <= MAX_BASE64_BYTES) {
    return ResultAsync.fromSafePromise(Promise.resolve(buffer));
  }
  return ResultAsync.fromPromise(
    sharp(buffer)
      .resize(TARGET_SIZE, TARGET_SIZE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer(),
    (e) => ({ message: `Image compression failed: ${String(e)}` }),
  ).andThen((compressed) => {
    const compressedB64Len = Math.ceil((compressed.byteLength / 3) * 4);
    if (compressedB64Len > MAX_BASE64_BYTES) {
      return err({
        message: `Image is too large even after compression (${compressedB64Len} bytes base64, limit ${MAX_BASE64_BYTES}). Please supply a smaller image.`,
      });
    }
    return ok(compressed);
  });
}

/**
 * Reads an image from disk, compresses it with sharp if it would exceed the
 * 500 KB base64 limit, and returns a raw base64 string (no data-URI prefix).
 */
export function processImagePath(filePath: string): ResultAsync<string, ImageError> {
  return ResultAsync.fromPromise(readFile(filePath), (e) => ({
    message: `Cannot read image file: ${filePath} — ${String(e)}`,
  }))
    .andThen((buffer) => compressImageBuffer(buffer))
    .map((buffer) => buffer.toString("base64"));
}
