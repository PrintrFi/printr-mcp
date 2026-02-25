import { existsSync, readFileSync } from "node:fs";
import { createServer as createHttpsServer } from "node:https";
import { createServer as createNetServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { buildApp } from "./app.js";

const thisDir = dirname(fileURLToPath(import.meta.url));

function loadCerts(): { cert: Buffer; key: Buffer } | null {
  // prod: dist/index.js → ../certs   dev: src/server/index.ts → ../../certs
  for (const rel of ["..", "../.."]) {
    const dir = join(thisDir, rel, "certs");
    const cert = join(dir, "fullchain.pem");
    const key = join(dir, "key.pem");
    if (existsSync(cert) && existsSync(key)) {
      return { cert: readFileSync(cert), key: readFileSync(key) };
    }
  }
  return null;
}

const certs = loadCerts();

/** Base URL for the local session API (used by the sign-page deep link). */
export const LOCAL_SESSION_ORIGIN = certs ? "https://local.printr.dev" : "http://localhost";

export {
  type ChainType,
  createSession,
  getSession,
  type TxResult,
  type TxSession,
} from "./sessions.js";

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createNetServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

async function findFreePort(start: number, end: number): Promise<number> {
  for (let port = start; port <= end; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in range ${start}–${end}`);
}

let serverPort: number | null = null;

/**
 * Starts the ephemeral session HTTP server on the first available port in the
 * range 5174–5200. Idempotent — subsequent calls return the already-bound port
 * without starting a second server.
 *
 * Uses Hono + `@hono/node-server`, compatible with Node.js ≥ 18 and Bun.
 *
 * @returns The port the server is listening on.
 */
export async function startSessionServer(): Promise<number> {
  if (serverPort !== null) return serverPort;

  const port = await findFreePort(5174, 5200);

  await new Promise<void>((resolve) => {
    serve(
      {
        fetch: buildApp().fetch,
        port,
        hostname: "127.0.0.1",
        ...(certs ? { createServer: createHttpsServer, serverOptions: certs } : {}),
      },
      () => resolve(),
    );
  });

  serverPort = port;
  return port;
}
