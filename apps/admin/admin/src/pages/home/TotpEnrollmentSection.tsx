import { Button, Field, LazyChunkBoundary, OscStatusBadge } from '@aklapper/ui';
import { type FormEvent, lazy } from 'react';

import styles from './AdminHomePage.module.css';

const LazyQrCodeSvg = lazy(() =>
  import('@aklapper/ui/qr-code').then(mod => ({ default: mod.QrCodeSvg })),
);

export interface TotpEnrollResponse {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
}

export interface TotpEnrollmentSectionProps {
  readonly totpEnabled: boolean;
  readonly securityBusy: boolean;
  readonly enrollment: TotpEnrollResponse | null;
  readonly verifyCode: string;
  readonly onVerifyCodeChange: (value: string) => void;
  readonly onStartEnroll: () => void;
  readonly onDisableTotp: () => void;
  readonly onVerifyTotp: (event: FormEvent<HTMLFormElement>) => void;
}

export function TotpEnrollmentSection({
  totpEnabled,
  securityBusy,
  enrollment,
  verifyCode,
  onVerifyCodeChange,
  onStartEnroll,
  onDisableTotp,
  onVerifyTotp,
}: TotpEnrollmentSectionProps) {
  return (
    <section className={styles.drawerSection}>
      <div className={styles.tileHeader}>
        <span className={styles.tileLabel}>TOTP Second Factor (2FA)</span>
        <OscStatusBadge
          source='totp'
          state={totpEnabled ? 'ready' : 'idle'}
          label={totpEnabled ? 'Enabled' : 'Disabled'}
        />
      </div>

      {totpEnabled ? (
        <div>
          <Button.Root
            type='button'
            variant='danger'
            loading={securityBusy}
            onClick={onDisableTotp}
          >
            <Button.Label>Disable TOTP 2FA</Button.Label>
          </Button.Root>
        </div>
      ) : (
        <div>
          <Button.Root
            type='button'
            variant='primary'
            loading={securityBusy}
            onClick={onStartEnroll}
          >
            <Button.Label>Enroll TOTP 2FA</Button.Label>
          </Button.Root>
        </div>
      )}

      {enrollment ? (
        <div className={styles.secretBlock}>
          <div className={styles.qrFrame}>
            <LazyChunkBoundary
              loadingLabel='Loading QR code...'
              errorTitle='Unable to load TOTP QR code'
            >
              <LazyQrCodeSvg value={enrollment.otpauthUrl} size={184} label='TOTP 2FA QR Code' />
            </LazyChunkBoundary>
          </div>
          <div>
            <div className={styles.tileLabel}>Base32 Secret</div>
            <code data-testid='totp-secret' className={styles.codeText}>
              {enrollment.secret}
            </code>
          </div>
          <div>
            <div className={styles.tileLabel}>otpauth:// URI</div>
            <code data-testid='totp-uri' className={styles.codeText}>
              {enrollment.otpauthUrl}
            </code>
          </div>
          <div>
            <div className={styles.tileLabel}>Single-Use Backup Codes</div>
            <ul className={styles.backupGrid}>
              {enrollment.backupCodes.map(code => (
                <li key={code} className={styles.backupCode}>
                  {code}
                </li>
              ))}
            </ul>
          </div>
          <form className={styles.inlineForm} onSubmit={onVerifyTotp}>
            <Field.Root>
              <Field.Label>6-Digit Verification Code</Field.Label>
              <Field.Control
                name='totpVerifyCode'
                inputMode='numeric'
                placeholder='123456'
                value={verifyCode}
                onChange={event => {
                  onVerifyCodeChange(event.target.value);
                }}
                required
              />
            </Field.Root>
            <Button.Root type='submit' variant='primary' loading={securityBusy}>
              <Button.Label>Verify &amp; Enable TOTP</Button.Label>
            </Button.Root>
          </form>
        </div>
      ) : null}
    </section>
  );
}
