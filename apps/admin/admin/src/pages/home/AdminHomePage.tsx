import type {
  AdminOverviewLoaderData,
  AdminServiceHealthStatus,
  Osc7501State,
} from '@aklapper/core';
import { Button, Drawer, Meter, OscStatusBadge, Separator, Toolbar, TuiWindow } from '@aklapper/ui';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';

import { type TotpEnrollResponse, TotpEnrollmentSection } from './TotpEnrollmentSection';

import styles from './AdminHomePage.module.css';

export interface AdminHomePageProps {
  data: AdminOverviewLoaderData;
  onRegisterPasskey?: () => Promise<void>;
}

interface ErrorPayload {
  error?: string;
  message?: string;
}

const QUICK_CONSOLE_LINKS = [
  { to: '/analytics', label: 'Analytics & CWV' },
  { to: '/cms', label: 'Postgres 19 CMS' },
  { to: '/inbox', label: 'Contact Inbox' },
  { to: '/quotas', label: 'Quotas & Buckets' },
  { to: '/ops', label: 'Cluster & CADENCE Ops' },
] as const;

function mapHealthToOscState(status: AdminServiceHealthStatus): Osc7501State {
  if (status === 'ok') return 'ready';
  if (status === 'degraded') return 'scaling';
  return 'error';
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ErrorPayload;
    return body.message ?? body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function AdminHomePage({ data, onRegisterPasskey }: AdminHomePageProps) {
  const { content, menuItems, health, metrics, security } = data;
  const services = [health.postgres, health.qdrant, health.portfolioPublic] as const;
  const [totpEnabled, setTotpEnabled] = useState(security.totpEnabled);
  const [passkeyCount, setPasskeyCount] = useState(security.passkeyCount);
  const [enrollment, setEnrollment] = useState<TotpEnrollResponse | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [securityBusy, setSecurityBusy] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  const tokenCap = Math.max(metrics.dailyTokenCap, 1);
  const tokenUsed = Math.min(metrics.dailyTokensUsed, tokenCap);

  async function handleStartTotpEnroll() {
    setSecurityBusy(true);
    setSecurityError(null);
    setSecurityMessage(null);
    try {
      const response = await fetch('/api/auth/totp/enroll', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to enroll TOTP 2FA.'));
      }
      const payload = (await response.json()) as TotpEnrollResponse;
      setEnrollment(payload);
      setVerifyCode('');
      setSecurityMessage(
        'TOTP secret generated. Scan the QR code with your authenticator app and enter a 6-digit code to activate 2FA.',
      );
    } catch (error) {
      setSecurityError(error instanceof Error ? error.message : 'TOTP enrollment failed.');
    } finally {
      setSecurityBusy(false);
    }
  }

  async function handleVerifyTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSecurityBusy(true);
    setSecurityError(null);
    setSecurityMessage(null);
    try {
      const response = await fetch('/api/auth/totp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Invalid TOTP verification code.'));
      }
      setTotpEnabled(true);
      setEnrollment(null);
      setVerifyCode('');
      setSecurityMessage('TOTP 2FA verified and enabled for this admin account.');
    } catch (error) {
      setSecurityError(error instanceof Error ? error.message : 'TOTP verification failed.');
    } finally {
      setSecurityBusy(false);
    }
  }

  async function handleDisableTotp() {
    setSecurityBusy(true);
    setSecurityError(null);
    setSecurityMessage(null);
    try {
      const response = await fetch('/api/auth/totp/disable', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to disable TOTP 2FA.'));
      }
      setTotpEnabled(false);
      setEnrollment(null);
      setSecurityMessage('TOTP 2FA disabled. Passkey authentication remains required.');
    } catch (error) {
      setSecurityError(error instanceof Error ? error.message : 'Failed to disable TOTP.');
    } finally {
      setSecurityBusy(false);
    }
  }

  async function handleRegisterPasskey() {
    if (!onRegisterPasskey) {
      setSecurityError('Browser WebAuthn registration handler is unavailable in this environment.');
      return;
    }
    setSecurityBusy(true);
    setSecurityError(null);
    setSecurityMessage(null);
    try {
      await onRegisterPasskey();
      setPasskeyCount(prev => prev + 1);
      setSecurityMessage('Additional hardware/platform passkey registered.');
    } catch (error) {
      setSecurityError(error instanceof Error ? error.message : 'Passkey registration failed.');
    } finally {
      setSecurityBusy(false);
    }
  }

  return (
    <div className={styles.frame}>
      <TuiWindow title={content.heading}>
        <div className={styles.card} aria-labelledby='admin-heading'>
          <div className={styles.headerRow}>
            <div className={styles.headerCopy}>
              <h1 id='admin-heading'>{content.heading}</h1>
              <p className={styles.subtitle}>{content.description}</p>
            </div>
            <Drawer.Root swipeDirection='right'>
              <Drawer.Trigger type='button'>Security Settings</Drawer.Trigger>
              <Drawer.Portal>
                <Drawer.Backdrop />
                <Drawer.Viewport>
                  <Drawer.Popup>
                    <Drawer.Content>
                      <Drawer.Title>Passkey &amp; TOTP Security Settings</Drawer.Title>
                      <Drawer.Description>
                        Manage hardware WebAuthn passkeys and optional TOTP second-factor auth for{' '}
                        {security.handle}@admin.
                      </Drawer.Description>
                      <div className={styles.drawerBody}>
                        {securityMessage ? (
                          <output className={styles.statusNote}>{securityMessage}</output>
                        ) : null}
                        {securityError ? (
                          <p role='alert' className={styles.errorNote}>
                            {securityError}
                          </p>
                        ) : null}

                        <section className={styles.drawerSection}>
                          <div className={styles.tileHeader}>
                            <span className={styles.tileLabel}>WebAuthn Passkeys</span>
                            <OscStatusBadge
                              source='passkeys'
                              state={passkeyCount > 0 ? 'ready' : 'gate'}
                              label={`${passkeyCount} registered`}
                            />
                          </div>
                          <p className={styles.tileDetail}>
                            Register a backup security key or platform authenticator while signed
                            in.
                          </p>
                          <div>
                            <Button.Root
                              type='button'
                              variant='secondary'
                              loading={securityBusy}
                              onClick={() => {
                                void handleRegisterPasskey();
                              }}
                            >
                              <Button.Label>Register Additional Passkey</Button.Label>
                            </Button.Root>
                          </div>
                        </section>

                        <TotpEnrollmentSection
                          totpEnabled={totpEnabled}
                          securityBusy={securityBusy}
                          enrollment={enrollment}
                          verifyCode={verifyCode}
                          onVerifyCodeChange={setVerifyCode}
                          onStartEnroll={() => {
                            void handleStartTotpEnroll();
                          }}
                          onDisableTotp={() => {
                            void handleDisableTotp();
                          }}
                          onVerifyTotp={event => {
                            void handleVerifyTotp(event);
                          }}
                        />

                        <div>
                          <Drawer.Close type='button'>Close</Drawer.Close>
                        </div>
                      </div>
                    </Drawer.Content>
                  </Drawer.Popup>
                </Drawer.Viewport>
              </Drawer.Portal>
            </Drawer.Root>
          </div>

          <section aria-label='System health'>
            <h2 className={styles.sectionTitle}>System Health</h2>
            <div className={styles.healthGrid}>
              {services.map(service => (
                <article key={service.name} className={styles.tile}>
                  <div className={styles.tileHeader}>
                    <strong>{service.name}</strong>
                    <OscStatusBadge
                      source={service.name.toLowerCase()}
                      state={mapHealthToOscState(service.status)}
                      label={service.status}
                    />
                  </div>
                  <p className={styles.tileDetail}>{service.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section aria-label='Live operations summary'>
            <h2 className={styles.sectionTitle}>Live Operations Snapshot</h2>
            <div className={styles.kpiGrid}>
              <article className={styles.tile}>
                <span className={styles.tileLabel}>Contact Submissions</span>
                <strong className={styles.tileValue}>{metrics.contactCount}</strong>
                <p className={styles.tileDetail}>Stored in PG19 contact_submissions</p>
              </article>
              <article className={styles.tile}>
                <span className={styles.tileLabel}>24h Sessions / Events</span>
                <strong className={styles.tileValue}>
                  {metrics.sessions24h} / {metrics.events24h}
                </strong>
                <p className={styles.tileDetail}>First-party telemetry rolling window</p>
              </article>
              <article className={styles.tile}>
                <span className={styles.tileLabel}>Pending CHORD Gates</span>
                <strong className={styles.tileValue}>{metrics.pendingGates}</strong>
                <p className={styles.tileDetail}>Awaiting human approval in /ops</p>
              </article>
            </div>
          </section>

          <div className={styles.meterBlock}>
            <Meter.Root value={tokenUsed} min={0} max={tokenCap}>
              <div className={styles.meterHeader}>
                <Meter.Label>Daily Global AI Token Utilization</Meter.Label>
                <Meter.Value>
                  {() =>
                    `${metrics.dailyTokensUsed.toLocaleString()} / ${metrics.dailyTokenCap.toLocaleString()} tokens`
                  }
                </Meter.Value>
              </div>
              <Meter.Track>
                <Meter.Indicator />
              </Meter.Track>
            </Meter.Root>
          </div>

          <Toolbar.Root className={styles.actions} aria-label='Admin actions'>
            {content.actions.map(action => (
              <Button.Link
                key={action.to}
                render={<Link to={action.to} prefetch='intent' />}
                variant={action.variant}
              >
                <Button.Label>{action.label}</Button.Label>
              </Button.Link>
            ))}
            {QUICK_CONSOLE_LINKS.filter(
              item => !content.actions.some(action => action.to === item.to),
            ).map(item => (
              <Button.Link
                key={item.to}
                render={<Link to={item.to} prefetch='intent' />}
                variant='secondary'
              >
                <Button.Label>{item.label}</Button.Label>
              </Button.Link>
            ))}
          </Toolbar.Root>

          <Separator.Root />

          <section aria-label='Menu registry summary'>
            <h2 className={styles.sectionTitle}>Portal &amp; Admin Menu Registry</h2>
            <ul className={styles.registryList}>
              {menuItems.map(item => (
                <li key={item.slug} className={styles.registryItem}>
                  [{item.keyShortcut}] <strong>{item.title}</strong> (
                  {item.adminOnly ? 'admin' : 'public'}) — {item.enabled ? 'enabled' : 'disabled'}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </TuiWindow>
    </div>
  );
}
