import { createServer as createNetServer } from "node:net";
import { serve } from "@hono/node-server";
import { buildApp } from "./app.js";

export { createSession, getSession, type ChainType, type TxResult, type TxSession } from "./sessions.js";

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
    serve({ fetch: buildApp().fetch, port, hostname: "127.0.0.1" }, () => resolve());
  });

  serverPort = port;
  return port;
}
