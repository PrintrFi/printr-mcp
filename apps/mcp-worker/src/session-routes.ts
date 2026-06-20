import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";

import type { CreateSessionInput, TxResult } from "./session-types.js";

/**
 * HTTP routes the Printr web signer talks to: create a session, poll it for the
 * payload, and report the signing result back. Ported from the local stdio
 * server (`packages/mcp/src/server/app.ts`), but backed by the
 * {@link SigningSessionDO} Durable Object instead of an in-memory map.
 */
export function sessionRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  app.use(
    "*",
    cors({
      origin: ["https://app.printr.money", "https://local.printr.dev"],
      credentials: true,
    }),
  );
  // Cap request bodies at 1MB to avoid memory-exhaustion via large payloads.
  app.use("*", bodyLimit({ maxSize: 1024 * 1024 }));

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/sessions", async (c) => {
    let input: CreateSessionInput;
    try {
      input = await c.req.json<CreateSessionInput>();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const token = crypto.randomUUID();
    const stub = c.env.SIGNING_SESSION.get(c.env.SIGNING_SESSION.idFromName(token));
    const { expires_at } = await stub.create(input, token);
    return c.json({ token, expires_at }, 201);
  });

  app.get("/sessions/:token", async (c) => {
    const token = c.req.param("token");
    const stub = c.env.SIGNING_SESSION.get(c.env.SIGNING_SESSION.idFromName(token));
    const session = await stub.read();
    return session ? c.json(session) : c.json({ error: "Session not found or expired" }, 404);
  });

  app.put("/sessions/:token/result", async (c) => {
    let result: TxResult;
    try {
      result = await c.req.json<TxResult>();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const token = c.req.param("token");
    const stub = c.env.SIGNING_SESSION.get(c.env.SIGNING_SESSION.idFromName(token));
    const ok = await stub.setResult(result);
    return ok ? c.json({ ok: true }) : c.json({ error: "Session not found or expired" }, 404);
  });

  return app;
}
