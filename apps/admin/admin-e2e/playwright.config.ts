import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src',
  use: {
    baseURL: process.env['ADMIN_BASE_URL'] ?? 'http://127.0.0.1:4201',
    trace: 'on-first-retry',
  },
});
