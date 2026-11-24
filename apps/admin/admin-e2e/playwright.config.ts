import { createSsrPlaywrightConfig } from '@aklapper/tooling/playwright';

export default createSsrPlaywrightConfig({
  configDir: import.meta.dirname,
  appDir: '../admin',
  defaultPort: 4301,
  baseUrlEnvVar: 'ADMIN_BASE_URL',
  portEnvVar: 'ADMIN_PORT',
});
