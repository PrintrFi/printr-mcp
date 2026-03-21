import { logger } from "@printr/sdk";
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

  // Logging middleware
  app.use("*", async (c, next) => {
    const start = Date.now();
    const path = c.req.path;
    const method = c.req.method;

    await next();

    const duration_ms = Date.now() - start;
    const status = c.res.status;

    logger.info(
      {
        method,
        path,
        status,
        duration_ms,
      },
      "HTTP request",
    );
  });

  // Allow specific HTTPS origins to fetch this localhost server.
  app.use("*", async (c, next) => {
    await next();
    c.header("Access-Control-Allow-Private-Network", "true");
  });
  app.use(
    "*",
    cors({
      origin: [
        "https://app.printr.money",
        "https://local.printr.dev",
        ...(process.env.NODE_ENV === "development" ? ["http://localhost:3000"] : []),
      ],
      credentials: true,
    }),
  );

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
    if (!stored) {
      return c.json({ error: "Session not found" }, 404);
    }
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
