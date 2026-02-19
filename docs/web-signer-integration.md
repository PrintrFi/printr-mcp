# Web Signer Integration — Printr Web App

This document specifies the `/sign` route that needs to be added to the Printr web app (`app.printr.money`) to support browser-based transaction signing from the Printr MCP agent.

---

## Overview

When a user is interacting with the Printr MCP agent and reaches the signing step, the agent can offer a browser-based signing alternative to providing a raw private key. The agent:

1. Starts a minimal ephemeral HTTP session API on `localhost` (inside the MCP process)
2. Stores the full unsigned transaction payload in that session
3. Returns a deep link: `https://app.printr.money/sign?session=TOKEN&api=http%3A%2F%2Flocalhost%3APORT`
   (the `api` value is `encodeURIComponent`-encoded by the agent)

The `/sign` page fetches the payload from the local session API, uses the existing Printr wallet stack to connect and sign, then writes the result back.

---

## New Route

```
GET /sign?session=<TOKEN>&api=<API_URL>
```

| Query param | Type | Description |
|---|---|---|
| `session` | `string` | Ephemeral session token (UUID) |
| `api` | `string` | URL-encoded base URL of the local session API (e.g. `http://localhost:5174`) |

---

## Session API Contract

The local session API is run by the MCP process. The `/sign` page communicates with it via standard `fetch`. All endpoints return JSON and include `Access-Control-Allow-Origin: *`.

> **Note:** The session is created in-process by the MCP agent before the deep link is generated. The `POST /sessions` endpoint exists on the server but is not used by the web app — it is an internal implementation detail.

### `GET {api}/sessions/{session}`

Fetch the signing session. Call this on page load.

**Response `200`:**
```ts
{
  token: string;
  chain_type: "evm" | "svm";
  payload: EvmPayload | SvmPayload;
  token_id: string;           // telecoin ID — use for trade page link
  rpc_url?: string;           // optional RPC override provided by agent
  created_at: number;         // epoch ms
  expires_at: number;         // epoch ms (30 min TTL)
}
```

**`EvmPayload`:**
```ts
{
  to: string;       // CAIP-10 (e.g. "eip155:8453:0x...")
  calldata: string; // hex-encoded
  value: string;    // wei as string
  gas_limit: number;
}
```

**`SvmPayload`:**
```ts
{
  mint_address: string;  // CAIP-10 (e.g. "solana:5eykt4...:PublicKey")
  ixs: Array<{
    program_id: string;
    accounts: Array<{ pubkey: string; is_signer: boolean; is_writable: boolean }>;
    data: string;  // base64-encoded instruction data
  }>;
  lookup_table?: string; // optional ALT address (base58)
}
```

**`404`** — session not found
**`410`** — session expired

### `PUT {api}/sessions/{session}/result`

Write the signing result after the transaction is submitted. Call this after a successful (or failed) submission.

**Request body:**
```ts
{
  status: "success" | "failed";
  tx_hash?: string;    // EVM transaction hash
  signature?: string;  // SVM transaction signature
  error?: string;      // error message if status is "failed"
}
```

**Response `200`:** `{ ok: true }`
**`404`** — session not found or expired

---

## Page Implementation Guide

### Chain detection

Use `chain_type` from the session to decide which wallet to connect and how to sign:

```ts
const isEvm = session.chain_type === "evm";
const isSvm = session.chain_type === "svm";
```

### EVM signing

Use the existing wagmi stack. Parse the chain ID from the `to` field (CAIP-10: `eip155:{chainId}:{address}`), switch to the correct chain, then send the transaction:

```ts
// Parse CAIP-10: "eip155:8453:0x..."
const [, chainIdStr, toAddress] = session.payload.to.split(":");
const chainId = Number(chainIdStr);

// Switch chain if needed, then:
const hash = await walletClient.sendTransaction({
  to: toAddress,
  data: payload.calldata as `0x${string}`,
  value: BigInt(payload.value),
  gas: BigInt(payload.gas_limit),
  chainId,
});
```

If the session includes `rpc_url`, use it as the transport RPC. Otherwise fall back to the wagmi-configured RPC for the chain.

### SVM signing

Use the existing `@solana/wallet-adapter-react` stack. Reconstruct the versioned transaction from `ixs`, sign, and send:

```ts
import {
  Connection, PublicKey, TransactionInstruction,
  TransactionMessage, VersionedTransaction,
} from "@solana/web3.js";

const connection = new Connection(session.rpc_url ?? "https://api.mainnet-beta.solana.com");
const instructions = payload.ixs.map(
  (ix) => new TransactionInstruction({
    programId: new PublicKey(ix.program_id),
    keys: ix.accounts.map((a) => ({
      pubkey: new PublicKey(a.pubkey),
      isSigner: a.is_signer,
      isWritable: a.is_writable,
    })),
    data: Buffer.from(ix.data, "base64"),
  }),
);

const { blockhash } = await connection.getLatestBlockhash();
const message = new TransactionMessage({
  payerKey: wallet.publicKey,
  recentBlockhash: blockhash,
  instructions,
}).compileToV0Message(/* altAccounts if lookup_table present */);

const tx = new VersionedTransaction(message);
const signed = await wallet.signTransaction(tx);
const signature = await connection.sendRawTransaction(signed.serialize());
```

### Result submission

After the transaction is sent, PUT the result back to the session API:

```ts
await fetch(`${apiUrl}/sessions/${sessionToken}/result`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    status: "success",
    tx_hash: hash,       // EVM
    // signature: sig,   // SVM
  }),
});
```

On error, PUT `{ status: "failed", error: errorMessage }`.

---

## UI / UX States

| State | Description |
|---|---|
| **Loading** | Fetching session from local API on mount |
| **Expired / Not found** | Session token invalid or TTL exceeded — show friendly error, no retry |
| **Connect wallet** | Session loaded; show token summary card + "Connect MetaMask" or "Connect Phantom" button based on `chain_type` |
| **Ready to sign** | Wallet connected; show tx details (chain, estimated cost) + "Sign & Submit" button |
| **Signing** | In-progress spinner after button click |
| **Success** | Show tx hash, block explorer link, and trade page link: `https://app.printr.money/trade/{token_id}` |
| **Error** | Show error message + "Try again" button |

---

## Token Summary Card

Display the following from the session on the connect/ready states:

| Field | Source |
|---|---|
| Token ID | `session.token_id` |
| Chain | `session.chain_type` (`"EVM"` / `"Solana"`) |
| Trade page (post-signing) | `https://app.printr.money/trade/{session.token_id}` |

---

## CORS Note

The local session API runs on `http://localhost:{port}` and sets `Access-Control-Allow-Origin: *`. Modern browsers (Chrome, Firefox, Safari) treat `localhost` as a secure origin and permit HTTPS pages to fetch from it. No additional configuration is required on the web app side.

---

## Local Development

To test against a local Printr dev server, set the `PRINTR_APP_URL` environment variable before starting the MCP server:

```json
{
  "mcpServers": {
    "printr": {
      "command": "bun",
      "args": ["run", "/path/to/printr-mcp/src/index.ts"],
      "env": {
        "PRINTR_API_KEY": "<your-api-key>",
        "PRINTR_APP_URL": "http://localhost:3000"
      }
    }
  }
}
```

The MCP server reads `PRINTR_APP_URL` at startup and uses it for all deep links, including the `printr_open_web_signer` signing URL. This generates a link to `http://localhost:3000/sign?session=...&api=...` instead of production.
