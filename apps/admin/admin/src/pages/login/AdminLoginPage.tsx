import { Button, Field, Separator, TuiWindow } from '@aklapper/ui';
import { type FormEvent, useState } from 'react';

import { CreatePasskeyPanel, TotpChallengePanel } from './AdminLoginStepPanels';
import {
  type AuthenticationOptionsJSON,
  createPasskeyCredential,
  getPasskeyAssertion,
  type RegistrationOptionsJSON,
} from './webauthnClient';

import styles from './AdminLoginPage.module.css';

export interface AdminLoginPageProps {
  nextTarget?: string;
  onAuthenticated?: (target: string) => void;
}

interface AuthErrorResponse {
  error?: string;
  message?: string;
}

interface LoginOptionsResponse {
  challengeId: string;
  options: AuthenticationOptionsJSON;
}

interface RegisterOptionsResponse {
  challengeId: string;
  options: RegistrationOptionsJSON;
}

interface AuthStepResponse {
  verified: boolean;
  requiresTotp?: boolean;
  pendingToken?: string;
  passkeyCount?: number;
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as AuthErrorResponse;
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function AdminLoginPage({ nextTarget = '/', onAuthenticated }: AdminLoginPageProps) {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [pendingTotpToken, setPendingTotpToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [passkeyPromptActive, setPasskeyPromptActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const completeNavigation = () => {
    const target = nextTarget.startsWith('/') && !nextTarget.startsWith('//') ? nextTarget : '/';
    if (onAuthenticated) {
      onAuthenticated(target);
      return;
    }
    window.location.assign(target);
  };

  async function handlePasswordSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedHandle = handle.trim();
    if (!trimmedHandle || !password) {
      setErrorMessage('Admin handle and password are required.');
      setStatusMessage(null);
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setStatusMessage('Verifying admin credentials...');

    try {
      const res = await fetch('/api/auth/password/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle: trimmedHandle, password }),
      });
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, 'Invalid credentials.'));
      }

      const data = (await res.json()) as AuthStepResponse;
      setPassword('');

      if (data.requiresTotp && data.pendingToken) {
        setPendingTotpToken(data.pendingToken);
        setStatusMessage('Password verified. Enter your 6-digit TOTP or backup code to continue.');
        return;
      }

      if (data.passkeyCount === 0) {
        setPasskeyPromptActive(true);
        setStatusMessage(
          'Signed in. Create a passkey for faster passwordless sign-in or continue to console.',
        );
        return;
      }

      setStatusMessage('Authenticated. Redirecting to ops console...');
      completeNavigation();
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : 'Password authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePasskeySignIn() {
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage('Requesting WebAuthn login challenge...');

    try {
      const optionsRes = await fetch('/api/auth/passkey/login/options', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle: handle.trim() || undefined }),
      });
      if (!optionsRes.ok) {
        throw new Error(await parseErrorMessage(optionsRes, 'Failed to start passkey sign-in.'));
      }

      const { challengeId, options } = (await optionsRes.json()) as LoginOptionsResponse;
      setStatusMessage('Waiting for authenticator verification...');
      const assertion = await getPasskeyAssertion(options);

      const verifyRes = await fetch('/api/auth/passkey/login/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challengeId, response: assertion }),
      });
      if (!verifyRes.ok) {
        throw new Error(await parseErrorMessage(verifyRes, 'Passkey verification failed.'));
      }

      const verifyData = (await verifyRes.json()) as AuthStepResponse;
      if (verifyData.requiresTotp && verifyData.pendingToken) {
        setPendingTotpToken(verifyData.pendingToken);
        setStatusMessage('Passkey verified. Enter your 6-digit TOTP or backup code to continue.');
        return;
      }

      setStatusMessage('Authenticated. Redirecting to ops console...');
      completeNavigation();
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : 'Passkey authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleTotpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingTotpToken) return;

    setBusy(true);
    setErrorMessage(null);
    setStatusMessage('Verifying TOTP 2FA code...');

    try {
      const res = await fetch('/api/auth/totp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code: totpCode.trim(),
          pendingToken: pendingTotpToken,
        }),
      });
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, 'Invalid TOTP or backup code.'));
      }

      const verifyData = (await res.json()) as AuthStepResponse;
      setPendingTotpToken(null);
      setTotpCode('');

      if (verifyData.passkeyCount === 0) {
        setPasskeyPromptActive(true);
        setStatusMessage(
          '2FA verified. Create a passkey for faster passwordless sign-in or continue to console.',
        );
        return;
      }

      setStatusMessage('2FA verified. Redirecting to ops console...');
      completeNavigation();
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : 'TOTP verification failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePasskey() {
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage('Generating resident passkey challenge...');

    try {
      const optionsRes = await fetch('/api/auth/passkey/register/options', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!optionsRes.ok) {
        throw new Error(await parseErrorMessage(optionsRes, 'Failed to start passkey creation.'));
      }

      const { challengeId, options } = (await optionsRes.json()) as RegisterOptionsResponse;
      setStatusMessage('Touch your authenticator to create your passkey...');
      const credential = await createPasskeyCredential(options);

      const verifyRes = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challengeId, response: credential }),
      });
      if (!verifyRes.ok) {
        throw new Error(await parseErrorMessage(verifyRes, 'Passkey verification failed.'));
      }

      setStatusMessage('Passkey created. Redirecting to ops console...');
      completeNavigation();
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : 'Passkey creation failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.frame}>
      <TuiWindow title='admin.andrew-k.us // WebAuthn & Password Gate'>
        <div className={styles.card}>
          <div>
            <h1>Admin Passkey Gate</h1>
            <p className={styles.subtitle}>
              Sign in with your administrator password or a registered WebAuthn passkey, with
              optional TOTP 2FA step-up.
            </p>
          </div>

          {errorMessage ? (
            <div className={styles.alertError} role='alert'>
              {errorMessage}
            </div>
          ) : null}

          {statusMessage ? (
            <div className={styles.statusNote} aria-live='polite'>
              {statusMessage}
            </div>
          ) : null}

          {passkeyPromptActive ? (
            <CreatePasskeyPanel
              busy={busy}
              onCreatePasskey={() => {
                void handleCreatePasskey();
              }}
              onContinue={completeNavigation}
            />
          ) : pendingTotpToken ? (
            <TotpChallengePanel
              totpCode={totpCode}
              busy={busy}
              onTotpCodeChange={setTotpCode}
              onSubmit={event => {
                void handleTotpSubmit(event);
              }}
              onBack={() => {
                setPendingTotpToken(null);
                setTotpCode('');
                setErrorMessage(null);
                setStatusMessage(null);
              }}
            />
          ) : (
            <form
              className={styles.form}
              onSubmit={event => {
                void handlePasswordSignIn(event);
              }}
            >
              <Field.Root name='handle'>
                <Field.Label>Admin Handle</Field.Label>
                <Field.Control
                  type='text'
                  autoComplete='username webauthn'
                  placeholder='admin'
                  value={handle}
                  onChange={event => setHandle(event.currentTarget.value)}
                />
              </Field.Root>
              <Field.Root name='password'>
                <Field.Label>Password</Field.Label>
                <Field.Control
                  type='password'
                  autoComplete='current-password'
                  value={password}
                  onChange={event => setPassword(event.currentTarget.value)}
                />
              </Field.Root>
              <div className={styles.actions}>
                <Button.Root type='submit' variant='primary' loading={busy}>
                  <Button.Label>Sign in with Password</Button.Label>
                </Button.Root>
                <Button.Root
                  type='button'
                  variant='secondary'
                  disabled={busy}
                  onClick={() => {
                    void handlePasskeySignIn();
                  }}
                >
                  <Button.Label>Sign in with Passkey</Button.Label>
                </Button.Root>
              </div>
            </form>
          )}

          <Separator.Root />
          <p className={styles.subtitle}>
            Protected surface: <code>noindex, nofollow, noarchive</code> · Sessions persisted in
            PostgreSQL 19.
          </p>
        </div>
      </TuiWindow>
    </div>
  );
}
