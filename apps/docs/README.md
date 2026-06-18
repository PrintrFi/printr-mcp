# @printr/docs

The Printr documentation site, built with [Fumadocs](https://fumadocs.dev) on Next.js.

## Develop

```bash
bun run --cwd apps/docs dev        # http://localhost:3000
bun run --cwd apps/docs build      # production build
bun run --cwd apps/docs typecheck  # fumadocs-mdx + next typegen + tsc
```

## Deploy

Static export published to GitHub Pages by `.github/workflows/docs.yml` on pushes to `main`.
One-time setup: **Settings → Pages → Source = "GitHub Actions"**.

## Content

Docs are MDX files under `content/docs/`. Navigation order is controlled by `meta.json`
files. Add a page by dropping an `.mdx` file in and listing its slug in the nearest
`meta.json`.

## Notes

- `lib/source.ts` imports `.source/server` by relative path rather than the `collections/*`
  alias, because the monorepo-root `tsconfig.json` owns path resolution for this workspace.
- Keep `zod` on one version across the monorepo. A split version installs two `fumadocs-core`
  copies, widening `source.getPage().data` to base `PageData` (build passes, typecheck fails).
