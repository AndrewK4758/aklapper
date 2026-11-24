import { createSsrPlaywrightConfig } from '@aklapper/shared-utils/playwright';

export default createSsrPlaywrightConfig({
  configDir: import.meta.dirname,
  appDir: '../admin',
  defaultPort: 4301,
  baseUrlEnvVar: 'ADMIN_BASE_URL',
  portEnvVar: 'ADMIN_PORT',
});
