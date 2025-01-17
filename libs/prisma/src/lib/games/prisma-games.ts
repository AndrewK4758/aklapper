import { PrismaClient } from '@prisma/client';
import { configDotenv } from 'dotenv';
import { cwd } from 'process';
import url from '../get-prisma-db-url.ts';

configDotenv({ path: `${cwd()}/libs/prisma/env/.env.games` });

const prismaClientGames = new PrismaClient({
  datasourceUrl: url(process.env['NODE_ENV'] as string),
  errorFormat: 'pretty'
});

export default prismaClientGames;
