import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';

// Static export is served under a subpath on GitHub Pages, so prefix asset URLs.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          {/* biome-ignore lint/performance/noImgElement: static export, next/image disabled */}
          <img
            src={`${basePath}/logo-printr.jpg`}
            alt=""
            width={24}
            height={24}
            className="rounded-full"
          />
          {appName}
        </>
      ),
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
