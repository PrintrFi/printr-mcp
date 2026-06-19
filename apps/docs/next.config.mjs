import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// Set NEXT_PUBLIC_BASE_PATH (e.g. "/printr-mcp") when deploying to a GitHub
// Pages project site served from a subpath. Empty for local dev and custom
// domains.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Static HTML export for GitHub Pages (no Node server at runtime).
  output: 'export',
  basePath,
  images: { unoptimized: true },
  // twoslash + its VFS do dynamic fs/module access the bundler can't statically
  // resolve; keep them external so they run as plain Node when prerendering the
  // server-rendered snippet (components/twoslash-snippet.tsx).
  serverExternalPackages: ['twoslash', 'typescript', '@typescript/vfs'],
};

export default withMDX(config);
