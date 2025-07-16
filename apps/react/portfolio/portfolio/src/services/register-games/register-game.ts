import axios from 'axios';

const baseUrl = import.meta.env.VITE_GAMES_API_URL;

const registerGame = async (gameName: string): Promise<string | void> => {
  try {
    const resp = await axios.post(`${baseUrl}/games/${gameName}`);

    return resp.headers['current-game'];
  } catch (error) {
    console.error(error);
  }
};

export default registerGame;
