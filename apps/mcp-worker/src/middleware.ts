/** Constant-time string comparison via Web Crypto (avoids timing side-channels). */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.byteLength !== bb.byteLength) {
    return false;
  }
  return crypto.subtle.timingSafeEqual(ab, bb);
}

/** Extract the bearer token from an Authorization header, or "" if absent. */
function bearer(request: Request): string {
  const header = request.headers.get("Authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
}

/**
 * Bearer-token gate for the MCP transport endpoints. A no-op when
 * `MCP_AUTH_TOKEN` is unset — the public preview deployment stays open — so auth
 * is opt-in via `wrangler secret put MCP_AUTH_TOKEN`. Returns a 401 `Response`
 * to short-circuit on failure, or `null` to proceed.
 */
export function authorizeMcp(request: Request, env: Env): Response | null {
  const expected = env.MCP_AUTH_TOKEN;
  if (!expected) {
    return null;
  }
  const token = bearer(request);
  if (!token || !timingSafeEqual(token, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * Per-client rate limit. Keys by bearer token when present, else the client IP.
 * Returns a 429 `Response` when the limit is exceeded, or `null` to proceed.
 */
export async function enforceRateLimit(request: Request, env: Env): Promise<Response | null> {
  const key = bearer(request) || request.headers.get("cf-connecting-ip") || "anonymous";
  const { success } = await env.MCP_RATE_LIMIT.limit({ key });
  if (!success) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  return null;
}
