import type { GamePlayerValidation } from '@aklapper/types';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';
import registerGame from '../register-games/register-game.js';
import registerPlayers from '../register-games/registers-players.js';
import startGame from '../register-games/start-game.js';

/**
 * A Loader function from React Router DOM that registers players and starts a game.
 *
 * This function handles the process of registering a new game, adding players to it,
 * and initiating the game session. It performs the following steps:
 *  1. Registers the game with the server.
 *  2. Stores the game instance ID in session storage.
 *  3. Registers players for the game.
 *  4. Starts the game session.
 *  5. Redirects the user to the game page if successful, or to the games list page if an error occurs.
 *
 * @param {LoaderFunction}  { request } - The request object containing the game name.
 * @returns {Promise<void>} A redirect response to the game page or the games list page.
 */

const registerPlayersAndStartGame: LoaderFunction = async ({ params }: LoaderFunctionArgs): Promise<void> => {
  const { id } = params as { id: string };

  try {
    const gameInstanceID = await registerGame(id);

    if (gameInstanceID) {
      sessionStorage.setItem('__current_game__', gameInstanceID);
      const __current_game__: GamePlayerValidation = JSON.parse(gameInstanceID);

      const registered = await registerPlayers(id, __current_game__);

      if (registered) {
        const startGameResp = await startGame(id, __current_game__);

        if (startGameResp) {
          const { message, playersInOrder } = startGameResp;

          if (message === 'Game Started') {
            sessionStorage.setItem('playersIds', JSON.stringify(playersInOrder));
          }
        }
      }
    }
  } catch (error) {
    console.error(error);
  }
};

export default registerPlayersAndStartGame;
