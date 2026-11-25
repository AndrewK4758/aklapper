import { createSsrPlaywrightConfig } from '@aklapper/tooling/playwright';
import { defineConfig } from '@playwright/test';

const baseConfig = createSsrPlaywrightConfig({
  configDir: import.meta.dirname,
  appDir: '../portal',
  defaultPort: 4300,
  baseUrlEnvVar: 'PORTAL_BASE_URL',
  portEnvVar: 'PORTAL_PORT',
  extraEnv: {
    PORTAL_MAINTENANCE_MODE: process.env['PORTAL_MAINTENANCE_MODE'] ?? 'false',
  },
});

export default defineConfig({
  ...baseConfig,
  ...(baseConfig.webServer && !Array.isArray(baseConfig.webServer)
    ? {
        webServer: {
          ...baseConfig.webServer,
          command:
            'exec node --conditions=@aklapper/source ../portal-e2e/src/ask-harness.ts --serve-portal',
        },
      }
    : {}),
});
