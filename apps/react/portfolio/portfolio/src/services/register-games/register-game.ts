import type { GamePlayerValidation } from '@aklapper/types';
import axios from 'axios';

const baseUrl = import.meta.env.VITE_GAMES_API_URL;

const registerGame = async (gameName: string): Promise<GamePlayerValidation | void> => {
  try {
    const resp = await axios.post(`${baseUrl}/games/${gameName}`);

    const gameData: GamePlayerValidation = JSON.parse(resp.headers['current-game']);
    return gameData;
  } catch (error) {
    console.error(error);
  }
};

export default registerGame;
