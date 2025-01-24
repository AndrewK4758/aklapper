import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { defineConfig } from 'vitest/config';

const modules = {
  '@aklapper/prompt-builder': resolve(workspaceRoot, './libs/gen-ai/prompt-builder/src/index.ts'),
  '@aklapper/socket-io-server': resolve(workspaceRoot, './libs/socket-io/server/src/index.ts'),
  '@aklapper/types': resolve(workspaceRoot, './libs/types/src/index.ts'),
  '@aklapper/vertex-ai': resolve(workspaceRoot, './libs/gen-ai/vertex-ai/src/index.ts')
};

const config = defineConfig({
  root: cwd(),

  test: {
    name: 'vertex-api',
    alias: modules,
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8'
    }
  }
});

export default config;
