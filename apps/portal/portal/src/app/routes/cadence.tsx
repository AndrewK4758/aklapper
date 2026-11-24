import { OscStatusBadge, SandboxedArtifactFrame, TuiWindow } from '@aklapper/ui';

import styles from './cadence.module.css';

const STARTER_ARTIFACT = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><style>
:root{--a-bg:#121110;--a-fg:#e8e2d5;--a-accent:#ffd300;--a-pad:16px;--a-font:monospace}
body{margin:0;padding:var(--a-pad);background:var(--a-bg);color:var(--a-fg);font-family:var(--a-font),monospace}
strong{color:var(--a-accent)}
</style></head>
<body><strong>CADENCE Sandbox Ready</strong><p>Submit a prompt to spin up svc-cadence-demo on GKE.</p></body>
</html>`;

export default function PortalCadenceRoute() {
  return (
    <div className={styles.workspace}>
      <TuiWindow
        title='CADENCE Builder // portfolio-public'
        badge={<OscStatusBadge source='svc-cadence-demo' state='idle' label='0/1 replicas' />}
      >
        <p>
          Quota-gated prompt builder wired for live Go GKE scale-from-zero execution and Qdrant
          recall.
        </p>
        <SandboxedArtifactFrame title='CADENCE Artifact Preview' srcDoc={STARTER_ARTIFACT} />
      </TuiWindow>
    </div>
  );
}
