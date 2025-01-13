/* eslint-disable @typescript-eslint/no-explicit-any */

import { Prisma, PrismaClient } from '@prisma/client';
import { configDotenv } from 'dotenv';
import { cwd } from 'process';

configDotenv({ path: `${cwd()}/libs/prisma/.env` });

const url = (NODE_ENV: string) => {
  switch (NODE_ENV) {
    case 'production':
      return process.env['DB_URL_PROD'];
    case 'testing':
      return process.env['DB_URL_TEST'];
    default:
      return process.env['DB_URL_DEV'];
  }
};

const prismaClient = new PrismaClient({
  datasourceUrl:
    url(process.env['NODE_ENV'] ??  'development') 
    // ?? 'postgresql://postgres:11560000@localhost/aklapper?host=/cloudsql/games-424800:us-central1:aklapper/'
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
