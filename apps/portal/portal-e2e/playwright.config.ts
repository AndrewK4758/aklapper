import { createSsrPlaywrightConfig } from '@aklapper/shared-utils/playwright';

export default createSsrPlaywrightConfig({
  configDir: import.meta.dirname,
  appDir: '../portal',
  defaultPort: 4300,
  baseUrlEnvVar: 'PORTAL_BASE_URL',
  portEnvVar: 'PORTAL_PORT',
  extraEnv: {
    PORTAL_MAINTENANCE_MODE: process.env['PORTAL_MAINTENANCE_MODE'] ?? 'false',
  },
});
