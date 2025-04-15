import { gamesClient, type players } from '@aklapper/games-client';
import type { Email } from '@aklapper/types';

export default async function findPlayer(email: Email): Promise<players | null> {
  try {
    const player = await gamesClient.players.findFirstOrThrow({ where: { email: { equals: email } } });
    console.log(player, 'in find first');

    return player;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
