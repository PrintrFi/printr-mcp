import { html } from "hono/html";
import type { Child, FC } from "hono/jsx";

type LayoutProps = {
  title: string;
  script?: string;
  children?: Child;
};

export const Layout: FC<LayoutProps> = ({ title, children, script }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
      {/* Tailwind CDN */}
      <script src="https://cdn.tailwindcss.com" />
      <script
        dangerouslySetInnerHTML={{
          __html: `tailwind.config = { theme: { extend: { fontFamily: { sans: ["system-ui", "sans-serif"] } } } };`,
        }}
      />
      {/* Alpine.js CDN — deferred so body scripts defining components run first */}
      <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js" />
      {/* Hide x-cloak elements until Alpine initialises */}
      <style dangerouslySetInnerHTML={{ __html: "[x-cloak] { display: none !important; }" }} />
    </head>
    <body class="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center p-6 font-sans">
      <div class="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-8">
        {children}
      </div>
      {script && <script dangerouslySetInnerHTML={{ __html: script }} />}
    </body>
  </html>
);

/** Wraps a JSX page element with a <!DOCTYPE html> declaration. */
export const renderPage = (page: Child) => html`<!DOCTYPE html>${page}`;
