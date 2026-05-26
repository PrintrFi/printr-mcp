/**
 * Types-only entry point for the generated Printr OpenAPI surface.
 *
 * Consumers wanting strict response types without pulling any runtime code
 * — handy on Cloudflare Workers, browsers, and `verbatimModuleSyntax`
 * projects where every import has to justify its weight — should import
 * from here:
 *
 * ```ts
 * import type { paths, components, operations } from "@printr/sdk/openapi";
 * ```
 *
 * For runtime calls against the Printr API, use `@printr/sdk/client`.
 *
 * @module @printr/sdk/openapi
 */
export type { components, operations, paths } from "./api.gen.js";
