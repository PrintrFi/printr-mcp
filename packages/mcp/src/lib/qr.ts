import QRCode from "qrcode";

/**
 * Append a terminal-rendered QR code for `url` to the end of `text`.
 * Silently returns the original text if QR generation fails.
 */
export async function appendQr(text: string, url: string): Promise<string> {
  try {
    const qr = await QRCode.toString(url, { type: "terminal", small: true });
    return `${text}\n\nScan to open in browser:\n${qr}`;
  } catch {
    return text;
  }
}
