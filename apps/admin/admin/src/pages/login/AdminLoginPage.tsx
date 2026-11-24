import { Button, Field, Separator, Tabs, TuiWindow } from '@aklapper/ui';
import { type FormEvent, useState } from 'react';

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

interface LoginVerifyResponse {
  verified: boolean;
  requiresTotp?: boolean;
  pendingToken?: string;
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
  const [activeTab, setActiveTab] = useState<'signin' | 'bootstrap'>('signin');
  const [handle, setHandle] = useState('admin');
  const [bootstrapToken, setBootstrapToken] = useState('');
  const [pendingTotpToken, setPendingTotpToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
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

  async function handlePasskeySignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

      const verifyData = (await verifyRes.json()) as LoginVerifyResponse;
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

      setStatusMessage('2FA verified. Redirecting to ops console...');
      completeNavigation();
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : 'TOTP verification failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleBootstrapRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage('Validating bootstrap token and generating passkey challenge...');

    try {
      const optionsRes = await fetch('/api/auth/passkey/register/options', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-bootstrap-token': bootstrapToken.trim(),
        },
        body: JSON.stringify({ handle: handle.trim() || 'admin' }),
      });
      if (!optionsRes.ok) {
        throw new Error(
          await parseErrorMessage(optionsRes, 'Bootstrap token rejected or registration denied.'),
        );
      }

      const { challengeId, options } = (await optionsRes.json()) as RegisterOptionsResponse;
      setStatusMessage('Touch your authenticator to register your admin passkey...');
      const credential = await createPasskeyCredential(options);

      const verifyRes = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challengeId, response: credential }),
      });
      if (!verifyRes.ok) {
        throw new Error(
          await parseErrorMessage(verifyRes, 'Passkey registration verification failed.'),
        );
      }

      setStatusMessage('Passkey registered and session established. Redirecting...');
      completeNavigation();
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : 'Passkey registration failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.frame}>
      <TuiWindow title='admin.andrew-k.us // WebAuthn Passkey Gate'>
        <div className={styles.card}>
          <div>
            <h1>Admin Passkey Gate</h1>
            <p className={styles.subtitle}>
              Hardware-backed WebAuthn passkey authentication with optional TOTP 2FA step-up.
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

          <Tabs.Root
            value={activeTab}
            onValueChange={next => {
              if (next === 'signin' || next === 'bootstrap') {
                setActiveTab(next);
                setErrorMessage(null);
                setStatusMessage(null);
              }
            }}
          >
            <Tabs.List aria-label='Authentication mode'>
              <Tabs.Tab value='signin'>Passkey Sign In</Tabs.Tab>
              <Tabs.Tab value='bootstrap'>Bootstrap Passkey</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value='signin'>
              {pendingTotpToken ? (
                <form className={styles.form} onSubmit={handleTotpSubmit}>
                  <Field.Root name='totpCode'>
                    <Field.Label>2FA Verification Code (TOTP or Backup Code)</Field.Label>
                    <Field.Control
                      type='text'
                      inputMode='numeric'
                      autoComplete='one-time-code'
                      placeholder='123456'
                      value={totpCode}
                      onChange={event => setTotpCode(event.currentTarget.value)}
                      required
                    />
                  </Field.Root>
                  <div className={styles.actions}>
                    <Button.Root type='submit' variant='primary' loading={busy}>
                      <Button.Label>Verify 2FA Code</Button.Label>
                    </Button.Root>
                    <Button.Root
                      type='button'
                      variant='ghost'
                      disabled={busy}
                      onClick={() => {
                        setPendingTotpToken(null);
                        setTotpCode('');
                        setErrorMessage(null);
                        setStatusMessage(null);
                      }}
                    >
                      <Button.Label>Back to Passkey</Button.Label>
                    </Button.Root>
                  </div>
                </form>
              ) : (
                <form className={styles.form} onSubmit={handlePasskeySignIn}>
                  <Field.Root name='handle'>
                    <Field.Label>Admin Handle</Field.Label>
                    <Field.Control
                      type='text'
                      autoComplete='username webauthn'
                      value={handle}
                      onChange={event => setHandle(event.currentTarget.value)}
                    />
                  </Field.Root>
                  <div className={styles.actions}>
                    <Button.Root type='submit' variant='primary' loading={busy}>
                      <Button.Label>Sign in with Passkey</Button.Label>
                    </Button.Root>
                  </div>
                </form>
              )}
            </Tabs.Panel>

            <Tabs.Panel value='bootstrap'>
              <form className={styles.form} onSubmit={handleBootstrapRegister}>
                <Field.Root name='bootstrapHandle'>
                  <Field.Label>Admin Handle</Field.Label>
                  <Field.Control
                    type='text'
                    value={handle}
                    onChange={event => setHandle(event.currentTarget.value)}
                    required
                  />
                </Field.Root>
                <Field.Root name='bootstrapToken'>
                  <Field.Label>Bootstrap Token</Field.Label>
                  <Field.Control
                    type='password'
                    autoComplete='off'
                    placeholder='Enter ADMIN_BOOTSTRAP_TOKEN'
                    value={bootstrapToken}
                    onChange={event => setBootstrapToken(event.currentTarget.value)}
                    required
                  />
                </Field.Root>
                <div className={styles.actions}>
                  <Button.Root type='submit' variant='primary' loading={busy}>
                    <Button.Label>Register Bootstrap Passkey</Button.Label>
                  </Button.Root>
                </div>
              </form>
            </Tabs.Panel>
          </Tabs.Root>

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
