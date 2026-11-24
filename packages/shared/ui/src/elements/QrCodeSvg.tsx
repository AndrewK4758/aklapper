import { cx } from './_internal/elementFactory';
import { generateQrMatrix } from './qrMatrix';

import styles from './QrCodeSvg.module.css';

export interface QrCodeSvgProps {
  value: string;
  size?: number;
  label?: string;
  className?: string;
}

const QUIET_ZONE_MODULES = 4;

function buildQrSvgPath(modules: readonly (readonly boolean[])[]): string {
  const segments: string[] = [];
  for (let r = 0; r < modules.length; r += 1) {
    const row = modules[r]!;
    let c = 0;
    while (c < row.length) {
      if (!row[c]) {
        c += 1;
        continue;
      }
      const start = c;
      while (c < row.length && row[c]) {
        c += 1;
      }
      const runLength = c - start;
      segments.push(
        `M${start + QUIET_ZONE_MODULES},${r + QUIET_ZONE_MODULES}h${runLength}v1h-${runLength}z`,
      );
    }
  }
  return segments.join('');
}

export function QrCodeSvg({
  value,
  size = 184,
  label = 'TOTP Authenticator QR Code',
  className,
}: QrCodeSvgProps) {
  const matrix = generateQrMatrix(value);
  const totalModules = matrix.size + QUIET_ZONE_MODULES * 2;
  const pathData = buildQrSvgPath(matrix.modules);

  return (
    <svg
      role='img'
      aria-label={label}
      className={cx(styles.qr, className)}
      width={size}
      height={size}
      viewBox={`0 0 ${totalModules} ${totalModules}`}
      shapeRendering='crispEdges'
    >
      <rect x={0} y={0} width={totalModules} height={totalModules} fill='#ffffff' />
      <path d={pathData} fill='#000000' />
    </svg>
  );
}
