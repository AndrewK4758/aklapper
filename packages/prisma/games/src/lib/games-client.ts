import { PrismaClient } from '../../generated/client.js';
import url from './get-prisma-db-url.js';

export const gamesClient = new PrismaClient({
  datasourceUrl: url(process.env['NODE_ENV'] as string),
  errorFormat: 'pretty',
});
