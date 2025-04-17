import { gamesClient, type players } from '@aklapper/games-client';
import type { Player } from '@aklapper/games-components';

export default async function addPlayerToDb(player: Player): Promise<players | void> {
  try {
    const { name, id, currentTimeEntered, email } = player;

    const newPlayer = await gamesClient.players.create({
      data: {
        player_name: name,
        player_id: id,
        current_time_entered: currentTimeEntered,
        email: email,
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
