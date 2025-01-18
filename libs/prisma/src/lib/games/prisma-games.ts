import { PrismaClient } from '@prisma/client';
import { configDotenv } from 'dotenv';
import { cwd } from 'process';
import url from '../get-prisma-db-url.ts';
import { getNodeEnv } from '@aklapper/types-game';

configDotenv({ path: `${cwd()}/libs/prisma/env/.env.games` });

export const prismaClientGames = new PrismaClient({
  datasourceUrl: url(getNodeEnv()),
  errorFormat: 'pretty'
});
