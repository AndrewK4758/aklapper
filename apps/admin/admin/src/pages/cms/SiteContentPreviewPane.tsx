import { Button } from '@aklapper/ui';
import {
  SiteContentPreviewCanvas,
  type SiteContentPreviewViewport,
} from '@aklapper/ui/site-content-preview';

import styles from './SiteContentEditor.module.css';

export interface SiteContentPreviewPaneProps {
  readonly contentKey: string;
  readonly metadata: Record<string, unknown>;
  readonly viewport: SiteContentPreviewViewport;
  readonly hasValidationErrors: boolean;
  readonly onViewportChange: (viewport: SiteContentPreviewViewport) => void;
  readonly onClose: () => void;
}

export function SiteContentPreviewPane({
  contentKey,
  metadata,
  viewport,
  hasValidationErrors,
  onViewportChange,
  onClose,
}: SiteContentPreviewPaneProps) {
  return (
    <aside className={styles.previewPane} aria-label='Live site content preview'>
      <div className={styles.toolbar}>
        <span className={styles.subCardTitle}>Live Preview ({contentKey})</span>
        <div className={styles.toolbarGroup}>
          <Button.Root
            type='button'
            variant={viewport === 'desktop' ? 'primary' : 'secondary'}
            size='xs'
            aria-pressed={viewport === 'desktop'}
            onClick={() => {
              onViewportChange('desktop');
            }}
          >
            <Button.Label>Desktop</Button.Label>
          </Button.Root>
          <Button.Root
            type='button'
            variant={viewport === 'mobile' ? 'primary' : 'secondary'}
            size='xs'
            aria-pressed={viewport === 'mobile'}
            onClick={() => {
              onViewportChange('mobile');
            }}
          >
            <Button.Label>Mobile</Button.Label>
          </Button.Root>
          <Button.Root type='button' variant='ghost' size='xs' onClick={onClose}>
            <Button.Label>Hide Preview</Button.Label>
          </Button.Root>
        </div>
      </div>

      {hasValidationErrors ? (
        <output className={styles.noticeBanner}>
          Showing last valid snapshot while current draft has validation errors.
        </output>
      ) : null}

      <SiteContentPreviewCanvas contentKey={contentKey} metadata={metadata} viewport={viewport} />
    </aside>
  );
}
