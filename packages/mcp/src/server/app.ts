import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  type CreateSessionInput,
  createSession,
  sessions,
  setResult,
  type TxResult,
} from "./sessions.js";

export function buildApp() {
  const app = new Hono();

  // Allow HTTPS origins (e.g. app.printr.money) to fetch this localhost server.
  app.use("*", async (c, next) => {
    await next();
    c.header("Access-Control-Allow-Private-Network", "true");
  });
  app.use("*", cors());

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/sessions", async (c) => {
    let input: CreateSessionInput;
    try {
      input = await c.req.json<CreateSessionInput>();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const session = createSession(input);
    return c.json({ token: session.token, expires_at: session.expires_at }, 201);
  });

  app.get("/sessions/:token", (c) => {
    const token = c.req.param("token");
    const stored = sessions.get(token);
    if (!stored) return c.json({ error: "Session not found" }, 404);
    if (Date.now() > stored.expires_at) {
      sessions.delete(token);
      return c.json({ error: "Session expired" }, 410);
    }
    return c.json(stored);
  });

  app.put("/sessions/:token/result", async (c) => {
    const result = await c.req.json<TxResult>();
    const ok = setResult(c.req.param("token"), result);
    return ok ? c.json({ ok: true }) : c.json({ error: "Session not found or expired" }, 404);
  });

  return app;
}
