import { gamesClient, type players } from '@aklapper/games-client';
import type { Player } from '@aklapper/games-components';

export default async function addPlayerToDb(player: Player): Promise<players | void> {
  try {
    const { Name, Id, CurrentTimeEntered, Email } = player;

    const newPlayer = await gamesClient.players.create({
      data: {
        player_name: Name,
        player_id: Id,
        current_time_entered: CurrentTimeEntered,
        email: Email,
      },
    });

    return newPlayer;
  } catch (error) {
    console.log('IN ADD PLAYER \n\n\n');
    console.error(error);
    console.log('IN ADD PLAYER \n\n\n');
    throw error;
  }
}
