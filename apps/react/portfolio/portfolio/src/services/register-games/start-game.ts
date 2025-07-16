import type { GamePlayerValidation } from '@aklapper/types';
import axios from 'axios';

type DemoStartGame = { message: string; playersInOrder: { [key: string]: string } };

const baseUrl = import.meta.env.VITE_GAMES_API_URL;

const startGame = async (gameName: string, __current_game__: GamePlayerValidation): Promise<DemoStartGame | void> => {
  try {
    const resp = await axios.patch<DemoStartGame>(
      `${baseUrl}/games/${gameName}/start`,
      {},
      { headers: { 'current-game': JSON.stringify(__current_game__) } },
    );

    return resp.data;
  } catch (error) {
    console.error(error);
  }
};

export default startGame;
