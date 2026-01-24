import { defineConfig } from 'prisma/config';
import url from './get-prisma-db-url.js';
import { configDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { cwd } from 'node:process';

configDotenv({
  path: resolve(cwd(), 'packages/prisma/chinook/.env'),
});

export default defineConfig({
  schema: '../../prisma/schema.prisma',
  migrations: {
    path: '../../prisma/migrations',
  },
  datasource: {
    url: url(process.env['NODE_ENV'] as string),
  },
});
