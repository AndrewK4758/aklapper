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

      // if (asType === 'font') {
      //   const props: HtmlLinkProps = {
      //     rel: 'preload',
      //     href: asset,
      //     as: asType,
      //     type: `${asType}/${getFileExt(asset)}`,
      //   };

      //   preloadLinkElements.push(<link {...props} crossOrigin='anonymous' />);
      // }

      // if (asType === 'style') {
      //   const props: HtmlLinkProps = {
      //     rel: 'preload',
      //     href: asset,
      //     as: asType,
      //     type: `${asType}/${getFileExt(asset)}`,
      //   };
      //   props.rel = 'stylesheet';
      //   preloadLinkElements.push(<link {...props} />);
      // }

      // if (asType === 'image') {
      //   const props: HtmlLinkProps = {
      //     rel: 'preload',
      //     href: asset,
      //     as: asType,
      //   };
      //   props.rel = 'preload';
      //   preloadLinkElements.push(<link {...props} crossOrigin='anonymous' />);
      // }

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

// 1const getFileExt = (file: string) => file.split('.').pop();
