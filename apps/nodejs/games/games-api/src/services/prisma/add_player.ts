import { gamesClient, players } from '@aklapper/games-client';
import type { Player } from '@aklapper/games-components';

export default async function addPlayerToDb(player: Player): Promise<players | void> {
  try {
    const { Name, Id, InLobby, CurrentTimeEntered } = player;

    return await gamesClient.players.create({
      data: {
        player_name: Name,
        player_id: Id,
        in_lobby: InLobby,
        current_time_entered: CurrentTimeEntered,
      },
    });
  } catch (error) {
    console.error(error);
  }
}
