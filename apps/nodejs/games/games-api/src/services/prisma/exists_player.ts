import { gamesClient } from '@aklapper/games-client';
import type { Email } from '@aklapper/types';

export default async function existsPlayer(email: Email): Promise<boolean | null> {
  try {
    return gamesClient.players.exists({ where: { email: { equals: email } } });
  } catch (error) {
    console.error(error);
    return null;
  }
}
