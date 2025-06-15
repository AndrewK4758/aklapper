import type { ReactElement } from 'react';
import type { ManifestType } from '../types/types';

type HtmlLinkProps = {
  rel: string;
  href: string;
  as: string;
  type?: string;
};

export default function parseSsrManifestFile(ssrManifest: ManifestType) {
  const preloadLinkElements: ReactElement[] = [];
  if (ssrManifest) {
    console.log(Object.values(ssrManifest));
    // Use a Set to avoid duplicate links
    const allAssets = new Set<string>(Object.values(ssrManifest).flatMap(assets => assets));

    allAssets.forEach(asset => {
      const asType = getPreloadType(asset);
      const props: HtmlLinkProps = {
        rel: 'preload',
        href: asset,
        as: asType,
      };

      if (asType === 'font') {
        props.type = `font/${asset.split('.').pop()}`;
        preloadLinkElements.push(
          <link key={asset} href={props.href} as={props.as} type={props.type} crossOrigin={''} />,
        );
      }

      if (!props.type) {
        preloadLinkElements.push(<link key={asset} href={props.href} as={props.as} />);
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
