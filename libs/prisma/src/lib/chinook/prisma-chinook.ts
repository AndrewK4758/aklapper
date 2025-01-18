/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma, PrismaClient } from '@prisma/client';
import { configDotenv } from 'dotenv';
import { cwd } from 'process';
import url from '../get-prisma-db-url.ts';
import { getNodeEnv } from '@aklapper/types-game';

configDotenv({ path: `${cwd()}/libs/prisma/env/.env.chinook` });

const prismaClient = new PrismaClient({
  datasourceUrl: url(getNodeEnv()),
  errorFormat: 'pretty'
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
