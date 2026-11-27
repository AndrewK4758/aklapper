import { createSsrPlaywrightConfig } from '@aklapper/tooling/playwright';
import type { PlaywrightTestConfig } from '@playwright/test';

const parsedPort = Number(process.env['ADMIN_PORT'] ?? 4301);
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 4301;
const externalBaseURL = process.env['ADMIN_BASE_URL']?.trim();
const localhostBaseURL = `http://localhost:${port}`;
const parsedExternalUrl =
  externalBaseURL && externalBaseURL.length > 0 ? new URL(externalBaseURL) : null;
const resolvedBaseURL = parsedExternalUrl ? parsedExternalUrl.toString() : localhostBaseURL;

const baseConfig = createSsrPlaywrightConfig({
  configDir: import.meta.dirname,
  appDir: '../admin',
  defaultPort: 4301,
  baseUrlEnvVar: 'ADMIN_BASE_URL',
  portEnvVar: 'ADMIN_PORT',
  extraEnv: {
    HOST: '0.0.0.0',
    ADMIN_INTERNAL_AUTH_SECRET:
      process.env['ADMIN_INTERNAL_AUTH_SECRET'] || 'admin-e2e-internal-auth-secret-not-for-prod',
    INTERNAL_AUTH_SECRET:
      process.env['INTERNAL_AUTH_SECRET'] || 'e2e-internal-auth-secret-local-only',
  },
});

const config: PlaywrightTestConfig = {
  ...baseConfig,
  ...(baseConfig.webServer && !Array.isArray(baseConfig.webServer)
    ? {
        webServer: {
          ...baseConfig.webServer,
          command:
            'exec node --conditions=@aklapper/source ../admin-e2e/src/admin-api-harness.ts --serve-admin',
        },
      }
    : {}),
  // Admin E2E mutates shared singleton Postgres rows (guest quota policy)
  // across browser projects; run serially to prevent cross-project races.
  fullyParallel: false,
  workers: 1,
  use: {
    ...baseConfig.use,
    // WebAuthn requires a domain hostname (localhost), never a raw IP literal (127.0.0.1).
    baseURL: resolvedBaseURL,
  },
};

export default config;
