import { workspaceRoot } from '@nx/devkit';
import { configDotenv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { cwd } from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __filenanme = fileURLToPath(import.meta.url);
const __dirname = dirname(__filenanme);

configDotenv({ path: resolve(__dirname, 'env/.env') });

const modules = {
  '@aklapper/types': resolve(workspaceRoot, 'packages/types/src/index.ts'),
};

const config = defineConfig({
  root: cwd(),
  resolve: {
    alias: modules,
  },
  test: {
    name: 'vertex-ai',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: './tests/support/test-setup.ts',
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
    },
    passWithNoTests: true,
  },
});

export default config;
