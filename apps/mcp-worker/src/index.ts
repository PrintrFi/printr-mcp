import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerRemoteSafeTools } from "@printr/mcp/remote-safe";
import { createPrintrClient } from "@printr/sdk";
import { McpAgent } from "agents/mcp";

interface Env {
  /** Base URL of the Printr API. Defaults to the public preview API. */
  PRINTR_API_BASE_URL: string;
  /** Optional bearer token; the public preview API requires none. */
  PRINTR_API_KEY?: string;
  /** Durable Object namespace backing per-session MCP state. */
  MCP_OBJECT: DurableObjectNamespace;
}

/**
 * Remote Printr MCP server hosted on Cloudflare Workers. Exposes the
 * read + build-unsigned tool surface (via {@link registerRemoteSafeTools});
 * signing and keystore tools are intentionally excluded from the hosted server.
 */
export class PrintrMCP extends McpAgent<Env> {
  server = new McpServer({ name: "printr", version: "0.1.0" });

  async init(): Promise<void> {
    const client = createPrintrClient({
      baseUrl: this.env.PRINTR_API_BASE_URL,
      ...(this.env.PRINTR_API_KEY ? { apiKey: this.env.PRINTR_API_KEY } : {}),
    });

    registerRemoteSafeTools(this.server, client);
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> | Response {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    // Streamable HTTP transport (current MCP spec).
    if (url.pathname === "/mcp") {
      return PrintrMCP.serve("/mcp").fetch(request, env, ctx);
    }

    // SSE transport (legacy clients).
    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return PrintrMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
};
