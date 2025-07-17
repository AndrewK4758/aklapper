import { PrismaPg } from '@prisma/adapter-pg';
import { configDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { Prisma, PrismaClient } from '../generated/client.js';
import url from './get-prisma-db-url.js';

console.log(cwd());

configDotenv({
  path: resolve(cwd(), 'packages/prisma/chinook/.env'),
});

console.log(url(process.env['NODE_ENV'] as string));
console.log(process.env['NODE_ENV']);

const adapter = new PrismaPg({ connectionString: url(process.env['NODE_ENV'] as string) });
const prismaClient = new PrismaClient({ adapter });

export const gamesClient = prismaClient.$extends({
  model: {
    $allModels: {
      async exists<T>(this: T, where: Prisma.Args<T, 'findFirst'>): Promise<boolean> {
        const context = Prisma.getExtensionContext(this);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (context as any).findFirst(where);
        return result !== null;
      },
    },
  },
});
