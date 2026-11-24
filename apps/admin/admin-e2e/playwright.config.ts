import { createSsrPlaywrightConfig } from '@aklapper/tooling/playwright';
import type { PlaywrightTestConfig } from '@playwright/test';

const parsedPort = Number(process.env['ADMIN_PORT'] ?? 4301);
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 4301;
const externalBaseURL = process.env['ADMIN_BASE_URL']?.trim();
const localhostBaseURL = `http://localhost:${port}`;

const baseConfig = createSsrPlaywrightConfig({
  configDir: import.meta.dirname,
  appDir: '../admin',
  defaultPort: 4301,
  baseUrlEnvVar: 'ADMIN_BASE_URL',
  portEnvVar: 'ADMIN_PORT',
  extraEnv: {
    HOST: '0.0.0.0',
    INTERNAL_AUTH_SECRET:
      process.env['INTERNAL_AUTH_SECRET'] || 'e2e-internal-auth-secret-local-only',
    TOTP_ENCRYPTION_KEY: process.env['TOTP_ENCRYPTION_KEY'] || 'e2e-totp-encryption-key-local-only',
    ADMIN_BOOTSTRAP_TOKEN: process.env['ADMIN_BOOTSTRAP_TOKEN'] || 'e2e-bootstrap-token-local-only',
    WEBAUTHN_RP_ID: 'localhost',
    WEBAUTHN_ORIGIN: localhostBaseURL,
  },
});

const config: PlaywrightTestConfig = {
  ...baseConfig,
  use: {
    ...baseConfig.use,
    // WebAuthn requires a domain hostname (localhost), never a raw IP literal (127.0.0.1).
    baseURL: externalBaseURL && externalBaseURL.length > 0 ? externalBaseURL : localhostBaseURL,
  },
};

export default config;
