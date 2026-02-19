import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { generateTokenImage, processImagePath } from "./image.js";

const TMP_DIR = "/tmp/printr-image-test";

// Helpers ---------------------------------------------------------------

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 100, g: 150, b: 200, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

async function makeJpeg(width: number, height: number, quality = 90): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg({ quality })
    .toBuffer();
}

// Fixture setup ---------------------------------------------------------

beforeAll(async () => {
  await mkdir(TMP_DIR, { recursive: true });
});

afterAll(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

// processImagePath ------------------------------------------------------

describe("processImagePath", () => {
  it("returns err for a missing file", async () => {
    const result = await processImagePath("/tmp/does-not-exist-12345.png");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toMatch(/Cannot read image file/);
  });

  it("returns base64 for a small JPEG without compression", async () => {
    const buf = await makeJpeg(64, 64);
    const path = join(TMP_DIR, "small.jpg");
    await writeFile(path, buf);

    const result = await processImagePath(path);
    expect(result.isOk()).toBe(true);
    const b64 = result._unsafeUnwrap();
    expect(b64).toBeString();
    // Verify it decodes back to the same bytes
    expect(Buffer.from(b64, "base64").length).toBe(buf.length);
  });

  it("compresses a large PNG to under 500 KB base64", async () => {
    // 2048×2048 PNG is typically > 500 KB base64
    const buf = await makePng(2048, 2048);
    const path = join(TMP_DIR, "large.png");
    await writeFile(path, buf);

    const result = await processImagePath(path);
    expect(result.isOk()).toBe(true);
    const b64 = result._unsafeUnwrap();
    expect(b64.length).toBeLessThanOrEqual(500 * 1024);
  });

  it("returns a valid base64 string (no data-URI prefix)", async () => {
    const buf = await makeJpeg(128, 128);
    const path = join(TMP_DIR, "nodatauri.jpg");
    await writeFile(path, buf);

    const result = await processImagePath(path);
    expect(result.isOk()).toBe(true);
    const b64 = result._unsafeUnwrap();
    expect(b64).not.toStartWith("data:");
    expect(() => Buffer.from(b64, "base64")).not.toThrow();
  });
});

// generateTokenImage ----------------------------------------------------

describe("generateTokenImage", () => {
  it("returns err when OpenRouter returns a non-OK status", async () => {
    // Use an obviously invalid key — SDK throws or returns auth/API error.
    const result = await generateTokenImage({
      name: "TestCoin",
      symbol: "TST",
      description: "A test token",
      openrouterApiKey: "invalid-key-for-testing",
    });
    expect(result.isErr()).toBe(true);
    const msg = result._unsafeUnwrapErr().message;
    expect(msg).toMatch(/OpenRouter|Authentication|401|403/i);
  });
});
