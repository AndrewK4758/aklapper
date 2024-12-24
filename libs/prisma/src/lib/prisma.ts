import { configDotenv } from 'dotenv';

configDotenv({ path: `${cwd()}/libs/prisma/.env` });
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient, Prisma } from '@prisma/client';
import { cwd } from 'process';
const url = () =>
  process.env['NODE_ENV'] === 'production'
    ? process.env['DB_URL_SSL']
    : process.env['NODE_ENV'] === 'testing'
      ? process.env['DB_URL_TEST']
      : process.env['DB_URL_DEV'];

console.log(url());
const prismaClient = new PrismaClient({
  datasourceUrl: process.env['DB_URL_SERVICE_ACCT']
});

export const prisma = prismaClient.$extends({
  model: {
    $allModels: {
      async exists<T>(this: T, where: Prisma.Args<T, 'findFirst'>['where']): Promise<boolean> {
        const context = Prisma.getExtensionContext(this);

        const result = await (context as any).findFirst(where);
        return result !== null;
      }
    }
  }
});
