import { gamesClient, type players } from '@aklapper/games-client';
import type { Email } from '@aklapper/types';

export default async function findPlayer(email: Email): Promise<players | null> {
  try {
    const player = await gamesClient.players.findFirst({ where: { email: { equals: email } } });

    console.log('IN PRISMA SERVICE CALL', player);

    return player;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
