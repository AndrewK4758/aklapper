import { cx } from '../elements/_internal/elementFactory';

import styles from './SandboxedArtifactFrame.module.css';

export interface SandboxedArtifactFrameProps {
  title: string;
  srcDoc: string;
  className?: string;
}

export function SandboxedArtifactFrame({ title, srcDoc, className }: SandboxedArtifactFrameProps) {
  return (
    <iframe
      className={cx(styles.frame, className)}
      title={title}
      sandbox='allow-scripts'
      referrerPolicy='no-referrer'
      srcDoc={srcDoc}
    />
  );
}
