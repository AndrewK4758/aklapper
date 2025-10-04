import { prisma, Prisma } from '@aklapper/portfolio-client';
import type { Auth } from 'googleapis';

export default async function saveTokens(
  tokens: Auth.Credentials,
  userID: string,
): Promise<Prisma.userCreateArgs['data']> {
  try {
    const query: Prisma.userCreateArgs = {
      data: {
        access_token: tokens.access_token,
        user_id: userID,
        id_token: tokens.id_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
        token_type: tokens.token_type,
      },
    };

    return await prisma.user.create(query);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
