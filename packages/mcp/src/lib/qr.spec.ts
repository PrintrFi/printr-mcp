import { describe, expect, it, spyOn } from "bun:test";
import QRCode from "qrcode";
import { appendQr } from "./qr.js";

const TEST_URL = "https://app.printr.money/sign?session=abc123";
const TEST_TEXT = '{"status":"awaiting_signature"}';

describe("appendQr", () => {
  it("appends a QR code section to the text", async () => {
    const result = await appendQr(TEST_TEXT, TEST_URL);

    expect(result).toStartWith(TEST_TEXT);
    expect(result).toInclude("Scan to open in browser:");
  });

  it("includes the url in the QR output", async () => {
    const result = await appendQr(TEST_TEXT, TEST_URL);

    // The terminal QR block is non-empty
    const afterScan = result.split("Scan to open in browser:")[1];
    expect(afterScan?.trim().length).toBeGreaterThan(0);
  });

  it("separates text and QR with a blank line", async () => {
    const result = await appendQr(TEST_TEXT, TEST_URL);

    expect(result).toInclude(`${TEST_TEXT}\n\nScan to open in browser:`);
  });

  it("returns original text if QR generation throws", async () => {
    const spy = spyOn(QRCode, "toString").mockImplementation(() => {
      throw new Error("QR failure");
    });

    const result = await appendQr(TEST_TEXT, TEST_URL);
    expect(result).toBe(TEST_TEXT);

    spy.mockRestore();
  });

  it("returns original text if QR generation rejects", async () => {
    const spy = spyOn(QRCode, "toString").mockImplementation(() =>
      Promise.reject(new Error("QR async failure")),
    );

    const result = await appendQr(TEST_TEXT, TEST_URL);
    expect(result).toBe(TEST_TEXT);

    spy.mockRestore();
  });
});
