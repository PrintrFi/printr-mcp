import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
});

// Matches NEXT_PUBLIC_BASE_PATH in next.config.mjs so the static search index
// is fetched from the correct subpath on GitHub Pages.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider
          search={{
            options: { type: 'static', api: `${basePath}/api/search` },
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
