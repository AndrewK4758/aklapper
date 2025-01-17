/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma, PrismaClient } from '@prisma/client';
import { configDotenv } from 'dotenv';
import { cwd } from 'process';
import url from '../get-prisma-db-url.ts';

configDotenv({ path: `${cwd()}/libs/prisma/env/.env.chinook` });

const prismaClientChinook = new PrismaClient({
  datasourceUrl: url(process.env['NODE_ENV'] as string),
  errorFormat: 'pretty'
});

export const prisma = prismaClientChinook.$extends({
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
