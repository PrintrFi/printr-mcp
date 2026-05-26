import { OpenRouter } from "@openrouter/sdk";
import { err, errAsync, ok, okAsync, ResultAsync } from "neverthrow";
import type SharpDefault from "sharp";
import { env } from "./env.js";

type SharpFactory = typeof SharpDefault;
type FsPromisesModule = typeof import("node:fs/promises");
type PathModule = typeof import("node:path");

export type ImageError = { message: string };

// Lazy loaders keep `sharp` / `node:fs` / `node:path` out of the module's
// top-level imports so the SDK barrel can be evaluated in non-Node runtimes
// (Cloudflare Workers, browsers). They only fail when the caller actually
// invokes a code path that needs the missing module.

function loadSharp(): ResultAsync<SharpFactory, ImageError> {
  return ResultAsync.fromPromise(
    import("sharp").then((m) => (m as unknown as { default: SharpFactory }).default),
    () => ({
      message:
        "Image processing is unavailable in this runtime: 'sharp' could not be loaded. Requires Node.js.",
    }),
  );
}

function loadFsPromises(): ResultAsync<FsPromisesModule, ImageError> {
  return ResultAsync.fromPromise(import("node:fs/promises"), () => ({
    message:
      "Filesystem access is unavailable in this runtime: 'node:fs/promises' could not be loaded. Requires Node.js.",
  }));
}

function loadPath(): ResultAsync<PathModule, ImageError> {
  return ResultAsync.fromPromise(import("node:path"), () => ({
    message:
      "Path utilities are unavailable in this runtime: 'node:path' could not be loaded. Requires Node.js.",
  }));
}

/** Max base64 size the Printr API accepts (500 KB). */
const MAX_BASE64_BYTES = 500 * 1024;
/** Target output width/height when resizing (longest edge). */
const TARGET_SIZE = 512;
/** JPEG quality used when compressing. */
const JPEG_QUALITY = 80;

/**
 * Style requirements appended to every image generation prompt to ensure
 * the output is a suitable token avatar.
 */
const TOKEN_AVATAR_REQUIREMENTS =
  "Style: perfectly square 1:1 aspect ratio full-bleed composition, subject fills the entire " +
  "frame edge-to-edge with no white space, no padding, no borders, no margins, no letterboxing, " +
  "bold vibrant cartoon or illustrative art, solid or gradient background that extends to every " +
  "corner, absolutely no text, letters, numbers, or words anywhere in the image, " +
  "clean icon design that stays recognisable at small sizes, high contrast with vivid colours.";

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
  model?: string | undefined;
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
      loadSharp().andThen((sharp) =>
        ResultAsync.fromPromise(
          sharp(Buffer.from(base64, "base64"))
            .resize(TARGET_SIZE, TARGET_SIZE, { fit: "cover" })
            .jpeg({ quality: JPEG_QUALITY })
            .toBuffer(),
          (e) => ({ message: `Image optimisation failed: ${String(e)}` }),
        ).map((buf) => buf.toString("base64")),
      ),
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
    return okAsync(buffer);
  }
  return loadSharp()
    .andThen((sharp) =>
      ResultAsync.fromPromise(
        sharp(buffer)
          .resize(TARGET_SIZE, TARGET_SIZE, { fit: "cover" })
          .jpeg({ quality: JPEG_QUALITY })
          .toBuffer(),
        (e) => ({ message: `Image compression failed: ${String(e)}` }),
      ),
    )
    .andThen((compressed) => {
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
 * Validates that a file path is safe to read (no directory traversal).
 * Rejects paths containing traversal sequences or non-absolute paths.
 */
function validateImagePath(filePath: string): ResultAsync<string, ImageError> {
  // Path-segment check works without `node:path` (regex-only), so run it before
  // attempting to load the module. This way Workers consumers passing relative
  // / traversal paths still get a clear validation error rather than a
  // misleading "node:path unavailable" message.
  const hasTraversalSegment = (p: string): boolean =>
    p.split(/[/\\]/).some((segment) => segment === "..");

  if (hasTraversalSegment(filePath)) {
    return errAsync({ message: "Invalid file path: directory traversal not allowed" });
  }

  return loadPath().andThen((path) => {
    const normalizedPath = path.normalize(filePath);
    if (hasTraversalSegment(normalizedPath)) {
      return err({ message: "Invalid file path: directory traversal not allowed" });
    }
    if (!path.isAbsolute(normalizedPath)) {
      return err({ message: "Invalid file path: must be an absolute path" });
    }
    return ok(normalizedPath);
  });
}

/**
 * Reads an image from disk, compresses it with sharp if it would exceed the
 * 500 KB base64 limit, and returns a raw base64 string (no data-URI prefix).
 * Validates the path to prevent directory traversal attacks.
 */
export function processImagePath(filePath: string): ResultAsync<string, ImageError> {
  return validateImagePath(filePath)
    .andThen((validPath) =>
      loadFsPromises().andThen((fs) =>
        ResultAsync.fromPromise(fs.readFile(validPath), (e) => ({
          message: `Cannot read image file: ${validPath} — ${String(e)}`,
        })),
      ),
    )
    .andThen((buffer) => compressImageBuffer(buffer))
    .map((buffer) => buffer.toString("base64"));
}
