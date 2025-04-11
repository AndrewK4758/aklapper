/* eslint-disable @typescript-eslint/no-explicit-any */
import { configDotenv } from 'dotenv';
import { Prisma, PrismaClient } from '../../generated/client.js';
import url from './get-prisma-db-url.js';

const f = configDotenv();
console.log(f);

const prismaClient = new PrismaClient({
  datasourceUrl: url(process.env['NODE_ENV'] as string),
  errorFormat: 'pretty',
});

export const prisma = prismaClient.$extends({
  model: {
    $allModels: {
      async exists<T>(this: T, where: Prisma.Args<T, 'findFirst'>['where']): Promise<boolean> {
        const context = Prisma.getExtensionContext(this);

        const result = await (context as any).findFirst(where);
        return result !== null;
      },
    },
  },
});
