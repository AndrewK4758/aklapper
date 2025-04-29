import { Prisma, PrismaClient } from '../../generated/client.js';
import url from './get-prisma-db-url.js';

const prismaClient = new PrismaClient({
  datasourceUrl: url(process.env['NODE_ENV'] as string),
  errorFormat: 'pretty',
});

const prisma = prismaClient.$extends({
  model: {
    $allModels: {
      async exists<T>(this: T, where: Prisma.Args<T, 'findFirst'>['where']): Promise<boolean> {
        const context = Prisma.getExtensionContext(this);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (context as any).findFirst(where);
        return result !== null;
      },
    },
  },
});

export { prisma };
