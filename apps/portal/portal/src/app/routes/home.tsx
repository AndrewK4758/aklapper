import type { PortalHomeLoaderData } from '@aklapper/contracts';
import { loadPortalHomeDataWithPrerender } from '@aklapper/db';
import {
  buildZshCommandHandlers,
  Button,
  OscStatusBadge,
  Toolbar,
  TuiWindow,
  ZshP10kTerminal,
} from '@aklapper/ui';
import { useEffect, useMemo, useState } from 'react';
import { Link, type MetaArgs, useLoaderData, useNavigate } from 'react-router';

import { buildPortalPageMeta } from '../seo';

import styles from './home.module.css';

export async function loader(): Promise<PortalHomeLoaderData> {
  return loadPortalHomeDataWithPrerender();
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'andrew-k.us // Solar Forge Terminal',
    description:
      loaderData?.content.description ??
      'Interactive Solar Forge portfolio terminal and TUI workspace by Andrew Klapper.',
  });
}

export default function PortalGreeterRoute() {
  const { content, terminal } = useLoaderData() as PortalHomeLoaderData;
  const navigate = useNavigate();
  const [tuiOpen, setTuiOpen] = useState(false);

  const commands = useMemo(
    () =>
      buildZshCommandHandlers(terminal.commands, {
        navigate,
        openTui: () => setTuiOpen(true),
      }),
    [navigate, terminal.commands],
  );

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === 't') {
        event.preventDefault();
        setTuiOpen(prev => !prev);
      } else if (key === 'm') {
        event.preventDefault();
        void navigate('/menu');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [navigate]);

  return (
    <div className={styles.workspace}>
      <ZshP10kTerminal
        bannerTitle={terminal.bannerTitle}
        bannerMeta={terminal.bannerMeta}
        osLabel={terminal.osLabel}
        directory={terminal.directory}
        vcsBranch={terminal.vcsBranch}
        vcsState={terminal.vcsState}
        contextLabel={terminal.contextLabel}
        commands={commands}
        quickCommands={terminal.quickCommands}
        initialEntries={terminal.initialEntries}
        placeholder={terminal.placeholder}
        focusOnMount
        onEscape={() => setTuiOpen(false)}
      />

      {tuiOpen ? (
        <TuiWindow
          title={content.tuiTitle}
          onClose={() => setTuiOpen(false)}
          badge={
            <OscStatusBadge
              source={content.tuiBadge.source}
              state={content.tuiBadge.state}
              label={content.tuiBadge.label}
            />
          }
        >
          <div className={styles.tuiBody}>
            <h1 id='greeter-heading'>{content.heading}</h1>
            <p>{content.description}</p>
            <Toolbar.Root className={styles.actions} aria-label='Portal launch actions'>
              {content.actions.map(action => (
                <Button.Link
                  key={action.to}
                  render={<Link to={action.to} />}
                  variant={action.variant}
                >
                  <Button.Label>{action.label}</Button.Label>
                </Button.Link>
              ))}
            </Toolbar.Root>
          </div>
        </TuiWindow>
      ) : null}
    </div>
  );
}
