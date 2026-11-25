import type { K8sPodEvent, MenuItem, PortalMenuContent } from '@aklapper/core';
import { filterMenuForRole } from '@aklapper/core';
import {
  NavigationMenu,
  PaneLink,
  Separator,
  TuiWindow,
  useIsPaneActive,
  usePaneNavigation,
} from '@aklapper/ui';
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';

import styles from './PortalMenuPage.module.css';

export interface PortalMenuPageProps {
  content: PortalMenuContent;
  items: readonly MenuItem[];
  deployments?: Readonly<Record<string, K8sPodEvent>>;
  onNavigate: (to: string) => void;
}

function findDeploymentStatus(
  targetDeploy: string | null,
  deployments?: Readonly<Record<string, K8sPodEvent>>,
): K8sPodEvent | null {
  if (!targetDeploy || !deployments) return null;
  if (deployments[targetDeploy]) return deployments[targetDeploy];
  const stripped = targetDeploy.replace(/^svc-/, '');
  return deployments[stripped] ?? null;
}

export function PortalMenuPage({ content, items, deployments, onNavigate }: PortalMenuPageProps) {
  const isPaneActive = useIsPaneActive();
  const paneNav = usePaneNavigation();
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
        const route = `/${matched.slug}`;
        if (paneNav?.docked) {
          paneNav.push(route);
        } else {
          onNavigate(route);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPaneActive, onNavigate, paneNav, visibleItems]);

  return (
    <TuiWindow
      title={content.heading}
      onClose={() => (paneNav?.docked ? paneNav.exitTui() : onNavigate('/'))}
    >
      <div className={styles.card} aria-labelledby='menu-heading'>
        <h1 id='menu-heading'>{content.heading}</h1>
        <p>{content.description}</p>
        <Separator.Root />
        <NavigationMenu.Root orientation='vertical' className={styles.menuNav}>
          <NavigationMenu.List className={styles.menuList}>
            {visibleItems.map(item => {
              const podEvent = findDeploymentStatus(item.targetK8sDeploy, deployments);
              const pillState = podEvent
                ? podEvent.ready || podEvent.phase === 'Running'
                  ? 'ready'
                  : podEvent.phase === 'TriggeredScaleUp' ||
                      podEvent.phase === 'ContainerCreating' ||
                      podEvent.phase === 'Pending'
                    ? 'scaling'
                    : 'idle'
                : 'local';

              return (
                <NavigationMenu.Item key={item.slug} className={styles.menuItem}>
                  <NavigationMenu.Link
                    render={
                      <PaneLink
                        to={`/${item.slug}`}
                        render={<Link to={`/${item.slug}`} prefetch='intent' />}
                      />
                    }
                    className={styles.menuLink}
                  >
                    <span>
                      [{item.keyShortcut}] <strong>{item.title}</strong> — {item.description}
                    </span>
                    <span className={styles.menuTargetGroup}>
                      <span className={styles.menuTarget}>
                        {item.targetK8sDeploy ?? content.localTargetLabel}
                      </span>
                      {item.targetK8sDeploy && (
                        <span
                          className={styles.statusPill}
                          data-state={pillState}
                          data-testid={`menu-deploy-status-${item.slug}`}
                        >
                          {podEvent ? podEvent.phase : 'ScaledZero'}
                        </span>
                      )}
                    </span>
                  </NavigationMenu.Link>
                </NavigationMenu.Item>
              );
            })}
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </div>
    </TuiWindow>
  );
}
