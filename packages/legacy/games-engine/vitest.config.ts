import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@aklapper/legacy-games/types': resolve(import.meta.dirname, 'src/types/index.ts'),
      '@aklapper/legacy-games/models': resolve(import.meta.dirname, 'src/models/index.ts'),
      '@aklapper/legacy-games/chain': resolve(import.meta.dirname, 'src/chain/index.ts'),
      '@aklapper/legacy-games/game': resolve(import.meta.dirname, 'src/game/index.ts'),
      '@aklapper/legacy-games/components': resolve(import.meta.dirname, 'src/components/index.ts'),
      '@aklapper/legacy-games/games': resolve(import.meta.dirname, 'src/games/index.ts'),
      '@aklapper/legacy-games/chains': resolve(import.meta.dirname, 'src/chains/index.ts'),
      '@aklapper/legacy-games/utils': resolve(import.meta.dirname, 'src/utils/index.ts'),
      '@aklapper/legacy-games/mocks': resolve(import.meta.dirname, 'src/mocks/index.ts'),
    },
  },
  test: {
    name: 'legacy-games',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
  },
});
