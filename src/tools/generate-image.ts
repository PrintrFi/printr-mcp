import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResultAsync } from "neverthrow";
import { z } from "zod";
import { env } from "~/lib/env.js";
import { generateImageFromPrompt } from "~/lib/image.js";

const inputSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe(
      "Visual description of the token avatar image to generate. " +
        "Be specific about style, subject, and mood. " +
        "Standard token-avatar style requirements (square, no text, vivid colours) " +
        "are appended automatically.",
    ),
  model: z
    .string()
    .optional()
    .describe(
      `OpenRouter model ID override. Defaults to env.OPENROUTER_IMAGE_MODEL ` +
        `(currently: ${env.OPENROUTER_IMAGE_MODEL}).`,
    ),
});

const outputSchema = z.object({
  image_path: z
    .string()
    .describe(
      "Absolute path to the generated JPEG file (≤500 KB base64). Pass this to printr_create_token as image_path.",
    ),
  size_bytes: z.number().describe("Compressed file size in bytes"),
});

export function registerGenerateImageTool(server: McpServer): void {
  server.registerTool(
    "printr_generate_image",
    {
      description:
        "Generate a token avatar image using OpenRouter AI image generation. " +
        "The user's prompt is automatically wrapped in a token-avatar style template " +
        "(square aspect ratio, no text, vivid colours) to ensure a suitable result. " +
        "Returns the path to a compressed JPEG (≤500 KB) ready to pass as image_path " +
        "to printr_create_token. Only available when OPENROUTER_API_KEY is configured.",
      inputSchema,
      outputSchema,
    },
    async ({ prompt, model }) => {
      // generateImageFromPrompt already runs the output through sharp (JPEG, ≤512px).
      // We just need to decode the base64 and write it to a temp file.
      const result = await generateImageFromPrompt(prompt, {
        openrouterApiKey: env.OPENROUTER_API_KEY!,
        model,
      })
        .map((base64) => Buffer.from(base64, "base64"))
        .andThen((buffer) => {
          const filePath = join(tmpdir(), `printr-image-${Date.now()}.jpg`);
          return ResultAsync.fromPromise(
            writeFile(filePath, buffer).then(() => ({
              image_path: filePath,
              size_bytes: buffer.byteLength,
            })),
            (e) => ({ message: `Failed to write image file: ${String(e)}` }),
          );
        });

      if (result.isErr()) {
        return {
          content: [{ type: "text" as const, text: result.error.message }],
          isError: true as const,
        };
      }

      const data = result.value;
      return {
        structuredContent: data,
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
