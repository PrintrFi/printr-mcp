import type { MetadataRoute } from "next";

// Required for `output: export` — emit the manifest as a static file.
export const dynamic = "force-static";

// Static export is served under a subpath on GitHub Pages; icon URLs are
// prefixed so the manifest resolves them correctly.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Printr Docs",
    short_name: "Printr",
    description: "Launch cross-chain tokens from TypeScript or from an AI agent.",
    icons: [
      { src: `${basePath}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${basePath}/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
  };
}
