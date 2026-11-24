import type { PortalMenuLoaderData } from '@aklapper/contracts';
import { loadPortalMenuDataWithPrerender } from '@aklapper/db';
import { filterMenuForRole } from '@aklapper/shared-utils';
import { NavigationMenu, Separator, TuiWindow } from '@aklapper/ui';
import { useEffect, useMemo } from 'react';
import { Link, type MetaArgs, useLoaderData, useNavigate } from 'react-router';

import { buildPortalPageMeta } from '../seo';

import styles from './menu.module.css';

export async function loader(): Promise<PortalMenuLoaderData> {
  return loadPortalMenuDataWithPrerender();
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: `${loaderData?.content.heading ?? 'Launch Menu'} // andrew-k.us`,
    description:
      loaderData?.content.description ??
      'Select a Solar Forge module to explore CADENCE, RAG Q&A, Agensi skills, and contact workflows.',
  });
}

export default function PortalMenuRoute() {
  const { content, items } = useLoaderData() as PortalMenuLoaderData;
  const navigate = useNavigate();
  const visibleItems = useMemo(() => filterMenuForRole(items, 'guest'), [items]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const matched = visibleItems.find(
        item => item.keyShortcut.toLowerCase() === event.key.toLowerCase(),
      );
      if (matched) {
        event.preventDefault();
        void navigate(`/${matched.slug}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate, visibleItems]);

  return (
    <TuiWindow title={content.heading} onClose={() => void navigate('/')}>
      <div className={styles.card} aria-labelledby='menu-heading'>
        <h1 id='menu-heading'>{content.heading}</h1>
        <p>{content.description}</p>
        <Separator.Root />
        <NavigationMenu.Root orientation='vertical' className={styles.menuNav}>
          <NavigationMenu.List className={styles.menuList}>
            {visibleItems.map(item => (
              <NavigationMenu.Item key={item.slug} className={styles.menuItem}>
                <NavigationMenu.Link
                  render={<Link to={`/${item.slug}`} />}
                  className={styles.menuLink}
                >
                  <span>
                    [{item.keyShortcut}] <strong>{item.title}</strong> — {item.description}
                  </span>
                  <span className={styles.menuTarget}>
                    {item.targetK8sDeploy ?? content.localTargetLabel}
                  </span>
                </NavigationMenu.Link>
              </NavigationMenu.Item>
            ))}
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </div>
    </TuiWindow>
  );
}
