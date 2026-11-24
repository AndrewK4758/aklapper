import { loadWorkspaceEnv } from '@aklapper/node-runtime/env';
import { defineConfig } from 'drizzle-kit';

loadWorkspaceEnv({ startDir: import.meta.dirname });

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required in environment or workspace .env for drizzle-kit');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: databaseUrl,
  },
});
