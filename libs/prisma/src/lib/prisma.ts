import { Prisma, PrismaClient } from '@prisma/client';
import { configDotenv } from 'dotenv';
import { cwd } from 'process';

configDotenv({ path: `${cwd()}/libs/prisma/.env` });

/* eslint-disable @typescript-eslint/no-explicit-any */
const url = () => {
  switch (process.env['NODE_ENV']) {
    case 'production':
      return process.env['DB_URL_PROD'];
    case 'testing':
      return process.env['DB_URL_TEST'];
    case 'development':
      return process.env['DB_URL_DEV'];
    default:
      return process.env['INSTANCE_CONNECTION_NAME'];
  }
};

const prismaClient = new PrismaClient({
  datasourceUrl:
    url() ?? 'postgresql://postgres:11560000@localhost/aklapper?host=/cloudsql/games-424800:us-central1:aklapper/'
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
