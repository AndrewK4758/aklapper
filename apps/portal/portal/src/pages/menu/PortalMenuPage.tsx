import type { MenuItem, PortalMenuContent } from '@aklapper/core';
import { filterMenuForRole } from '@aklapper/core';
import { NavigationMenu, Separator, TuiWindow, useIsPaneActive } from '@aklapper/ui';
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';

import styles from './PortalMenuPage.module.css';

export interface PortalMenuPageProps {
  content: PortalMenuContent;
  items: readonly MenuItem[];
  onNavigate: (to: string) => void;
}

export function PortalMenuPage({ content, items, onNavigate }: PortalMenuPageProps) {
  const isPaneActive = useIsPaneActive();
  const visibleItems = useMemo(() => filterMenuForRole(items, 'guest'), [items]);

  useEffect(() => {
    if (!isPaneActive) return;
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
        onNavigate(`/${matched.slug}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPaneActive, onNavigate, visibleItems]);

  return (
    <TuiWindow title={content.heading} onClose={() => onNavigate('/')}>
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
