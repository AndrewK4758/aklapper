import styles from './SandboxedArtifactFrame.module.css';

export interface SandboxedArtifactFrameProps {
  title: string;
  srcDoc: string;
}

export function SandboxedArtifactFrame({ title, srcDoc }: SandboxedArtifactFrameProps) {
  return (
    <iframe
      className={styles.frame}
      title={title}
      sandbox='allow-scripts'
      referrerPolicy='no-referrer'
      srcDoc={srcDoc}
    />
  );
}
