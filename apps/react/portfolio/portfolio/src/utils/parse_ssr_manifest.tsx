import type { ReactElement } from 'react';
import type { ManifestType } from '../types/types';

type HtmlLinkProps = {
  rel: string;
  href: string;
  as?: string;
  type?: string;
};

export default function parseSsrManifestFile(ssrManifest: ManifestType) {
  const preloadLinkElements: ReactElement[] = [];
  if (ssrManifest) {
    const allAssets = new Set<string>(Object.values(ssrManifest).flatMap(assets => assets));

    allAssets.forEach(asset => {
      const asType = getPreloadType(asset);

      if (asType === 'script') {
        const props: HtmlLinkProps = {
          rel: 'modulepreload',
          href: asset,
        };
        preloadLinkElements.push(<link {...props} />);
      }
    });
  }

  return preloadLinkElements;
}

function getPreloadType(file: string) {
  switch (true) {
    case file.endsWith('.js'):
      return 'script';
    case file.endsWith('.css'):
      return 'style';
    case file.endsWith('.woff') || file.endsWith('.woff2') || file.endsWith('.ttf') || file.endsWith('.otf'):
      return 'font';
    case file.endsWith('.webp') || file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'):
      return 'image';
    default:
      return 'fetch';
  }
}
