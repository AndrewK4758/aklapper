import { Prisma, PrismaClient } from '@prisma/client';
import { configDotenv } from 'dotenv';
import { cwd } from 'process';

configDotenv({ path: `${cwd()}/libs/prisma/.env` });

/* eslint-disable @typescript-eslint/no-explicit-any */
const url = () => {
  if (process.env) {
    switch (process.env['NODE_ENV']) {
      case 'production':
        return process.env['PG_AE_URL'];
      case 'testing':
        return process.env['DB_URL_TEST'];
      case 'development':
        return process.env['DB_URL_DEV'];
      default:
        return process.env['AG_AE_URL'];
    }
  } else return 'postgresql://postgres:postgres@localhost:5431/aklapper';
};

const prismaClient = new PrismaClient({
  datasourceUrl: url()
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
