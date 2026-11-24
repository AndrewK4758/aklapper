import { Button, Field } from '@aklapper/ui';
import type { FormEvent } from 'react';

import styles from './AdminLoginPage.module.css';

export interface TotpChallengePanelProps {
  totpCode: string;
  busy: boolean;
  onTotpCodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
}

export function TotpChallengePanel({
  totpCode,
  busy,
  onTotpCodeChange,
  onSubmit,
  onBack,
}: TotpChallengePanelProps) {
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <Field.Root name='totpCode'>
        <Field.Label>2FA Verification Code (TOTP or Backup Code)</Field.Label>
        <Field.Control
          type='text'
          inputMode='numeric'
          autoComplete='one-time-code'
          placeholder='123456'
          value={totpCode}
          onChange={event => onTotpCodeChange(event.currentTarget.value)}
          required
        />
      </Field.Root>
      <div className={styles.actions}>
        <Button.Root type='submit' variant='primary' loading={busy}>
          <Button.Label>Verify 2FA Code</Button.Label>
        </Button.Root>
        <Button.Root type='button' variant='ghost' disabled={busy} onClick={onBack}>
          <Button.Label>Back to Sign In</Button.Label>
        </Button.Root>
      </div>
    </form>
  );
}

export interface CreatePasskeyPanelProps {
  busy: boolean;
  onCreatePasskey: () => void;
  onContinue: () => void;
}

export function CreatePasskeyPanel({ busy, onCreatePasskey, onContinue }: CreatePasskeyPanelProps) {
  return (
    <div className={styles.passkeyPrompt}>
      <div>
        <h2>Create a Passkey for Faster Sign-In</h2>
        <p className={styles.subtitle}>
          You are signed in. Register a device or hardware passkey now, or skip to open the console
          and enroll later in Security Settings.
        </p>
      </div>
      <div className={styles.actions}>
        <Button.Root type='button' variant='primary' loading={busy} onClick={onCreatePasskey}>
          <Button.Label>Create Passkey</Button.Label>
        </Button.Root>
        <Button.Root type='button' variant='ghost' disabled={busy} onClick={onContinue}>
          <Button.Label>Continue to Console</Button.Label>
        </Button.Root>
      </div>
    </div>
  );
}
