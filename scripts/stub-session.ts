/**
 * Dev script — spin up a local signing session and print the sign URL.
 *
 * Usage:
 *   bun run dev:stub-session           # SVM session (default)
 *   bun run dev:stub-session --evm     # EVM session
 *
 * Then open the printed URL in a browser pointing at a local web dev server.
 * The web app URL defaults to http://localhost:3000; override with PRINTR_APP_URL.
 */

import { LOCAL_SESSION_ORIGIN, createSession, startSessionServer } from "../src/server/index.js";

const isEvm = Bun.argv.includes("--evm");
const appUrl = Bun.env.PRINTR_APP_URL ?? "https://app.printr.money";

const TOKEN_ID = "0x1ae6a983dd953c47ff71e4ef82101bc5da66686ef7e25e05ef9e576a14c7c802";
const IMAGE_URL = `https://cdn.printr.money/t/${TOKEN_ID}/media/image`;

await Bun.write(Bun.stdout, "  Fetching image from CDN… ");
const imageRes = await fetch(IMAGE_URL);
const imageBuffer = await imageRes.arrayBuffer();
const mimeType = imageRes.headers.get("content-type") ?? "image/jpeg";
const imageDataUrl = `data:${mimeType};base64,${Buffer.from(imageBuffer).toString("base64")}`;
console.log(`done (${Math.round(imageBuffer.byteLength / 1024)} KB)`);

const TOKEN_META = {
  name: "R'lyeh",
  symbol: "RLYEH",
  description: "Emerging from the depths it comes",
  image_url: imageDataUrl,
};

// Realistic SVM payload — mirrors a real printr_create_token response structure:
// ix[0] compute budget, ix[1] token initialise, ix[2] initial buy
const CREATOR = "Ez4hEGekBmzgYYgDuwXW68LNzRUdHSTU1A1CLvLyumjR";
const MINT = "4hRGar9QsVTNpswpdp8TfwWXztc3MfUP9nEsSQuH7nsQ";
const PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"; // pump.fun-style program

const SVM_PAYLOAD = {
  ixs: [
    {
      // ComputeBudget::setComputeUnitLimit
      program_id: "ComputeBudget111111111111111111111111111111",
      accounts: [],
      data: "AQDKAAAA", // limit=200_000
    },
    {
      // ComputeBudget::setComputeUnitPrice
      program_id: "ComputeBudget111111111111111111111111111111",
      accounts: [],
      data: "AwDh9QUAAA==", // priority fee ~100_000 micro-lamports
    },
    {
      // token initialise / create
      program_id: PROGRAM,
      accounts: [
        { pubkey: MINT, is_signer: true, is_writable: true },
        { pubkey: CREATOR, is_signer: true, is_writable: true },
        { pubkey: "SysvarRent111111111111111111111111111111111", is_signer: false, is_writable: false },
        { pubkey: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", is_signer: false, is_writable: false },
        { pubkey: "11111111111111111111111111111111", is_signer: false, is_writable: false },
      ],
      data: "AQIDBAUGBwgJ", // stub instruction data
    },
    {
      // initial buy
      program_id: PROGRAM,
      accounts: [
        { pubkey: CREATOR, is_signer: true, is_writable: true },
        { pubkey: MINT, is_signer: false, is_writable: true },
        { pubkey: "So11111111111111111111111111111111111111112", is_signer: false, is_writable: false },
        { pubkey: "11111111111111111111111111111111", is_signer: false, is_writable: false },
      ],
      data: "AwAAAAAAAAA=", // stub buy data
    },
  ],
  lookup_table: "AQhB2GD7ixcioSjLK6FdzdEUKMEfSWhGPDzicjF9qBqm",
  mint_address: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:${MINT}`,
};

// Realistic EVM payload — Base mainnet, non-zero value (~$10 of ETH at ~$2k)
const EVM_PAYLOAD = {
  to: "eip155:8453:0x6Ee2b5723373c5A12b17fEc2a7a8bE1B2F84bd3F",
  calldata:
    "0x5f5755290000000000000000000000000000000000000000000000000000000000000080" +
    "0000000000000000000000000000000000000000000000000000000000000000" +
    "000000000000000000000000000000000000000000000000002386f26fc10000" +
    "00000000000000000000000000000000000000000000000000000000000000c0",
  value: "5000000000000000", // 0.005 ETH ≈ $10
  gas_limit: 350000,
};

const port = await startSessionServer();
const session = createSession({
  chain_type: isEvm ? "evm" : "svm",
  payload: isEvm ? EVM_PAYLOAD : SVM_PAYLOAD,
  token_id: TOKEN_ID,
  token_meta: TOKEN_META,
  rpc_url: isEvm
    ? "https://mainnet.base.org"
    : "https://api.mainnet-beta.solana.com",
});

const apiUrl = `${LOCAL_SESSION_ORIGIN}:${port}`;
const signUrl = `${appUrl}/sign?session=${session.token}&api=${encodeURIComponent(apiUrl)}`;

console.log();
console.log(`  chain   : ${isEvm ? "EVM (Base)" : "SVM (Solana)"}`);
console.log(`  token   : ${TOKEN_META.name} (${TOKEN_META.symbol})`);
console.log(`  image   : ${IMAGE_URL} (embedded as base64)`);
console.log(`  api     : ${apiUrl}`);
console.log(`  expires : ${new Date(session.expires_at).toISOString()}`);
console.log();
console.log(`  Sign URL:`);
console.log(`  ${signUrl}`);
console.log();
console.log("  Press Ctrl+C to stop.\n");

// Keep the process alive so the session server stays up.
await Bun.sleep(Infinity);
