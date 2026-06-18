# @printr/docs

The Printr documentation site, built with [Fumadocs](https://fumadocs.dev) on Next.js.

## Develop

```bash
bun run --cwd apps/docs dev        # http://localhost:3000
bun run --cwd apps/docs build      # production build
bun run --cwd apps/docs typecheck  # fumadocs-mdx + next typegen + tsc
```

## Content

Docs are MDX files under `content/docs/`. Navigation order is controlled by `meta.json`
files. Add a page by dropping an `.mdx` file in and listing its slug in the nearest
`meta.json`.

## Notes

- **`zod` is pinned to `^4.4.3` here on purpose.** `fumadocs-mdx` depends on `zod@^4.4.3`,
  while the SDK packages pin `~4.3.6`. Without this pin, Bun installs two `fumadocs-core`
  copies (one per `zod` version) and the mismatched module identity widens
  `source.getPage().data` to the base `PageData`, dropping `body`/`toc`/`full` at type level.
- `lib/source.ts` imports `.source/server` by relative path rather than the `collections/*`
  alias, because the monorepo-root `tsconfig.json` owns path resolution for this workspace.
