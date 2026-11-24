import type { PortalHomeLoaderData } from '@aklapper/contracts';
import { loadPortalHomeDataWithPrerender } from '@aklapper/db';
import { useMemo } from 'react';
import { type MetaArgs, useLoaderData, useNavigate } from 'react-router';

import { PortalHomePage } from '#pages/home';

import { buildPortalPageMeta } from '../seo';
import { createPortalTerminalForms } from '../terminalForms';

export async function loader(): Promise<PortalHomeLoaderData> {
  return loadPortalHomeDataWithPrerender();
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Andrew Klapper Portfolio',
    description:
      loaderData?.content.description ??
      'Interactive Solar Forge portfolio terminal and TUI workspace by Andrew Klapper.',
  });
}

export default function PortalGreeterRoute() {
  const { content, terminal, contactForm } = useLoaderData() as PortalHomeLoaderData;
  const navigate = useNavigate();

  const terminalForms = useMemo(
    () => createPortalTerminalForms(contactForm, navigate),
    [contactForm, navigate],
  );

  return (
    <PortalHomePage
      content={content}
      terminal={terminal}
      terminalForms={terminalForms}
      onNavigate={to => {
        void navigate(to);
      }}
    />
  );
}
