import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    name: 'root-config',
    projects: ['apps/react/*', 'apps/nodejs*', 'packages/*'],
  },
});
