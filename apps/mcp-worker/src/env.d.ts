// MCP_AUTH_TOKEN is an optional secret (set via `wrangler secret put MCP_AUTH_TOKEN`),
// so it is not declared in wrangler.jsonc and not part of the `wrangler types`
// output. Declaration-merge it onto the generated global Env. When unset, the
// MCP endpoints stay open (keyless preview).
interface Env {
  MCP_AUTH_TOKEN?: string;
}
