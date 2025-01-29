import { redirect, type ActionFunction, type ActionFunctionArgs } from 'react-router';
import registerGame from '../register-games/register-game';
import registerPlayers from '../register-games/registers-players';
import startGame from '../register-games/start-game';
import type { GamePlayerValidation } from '@aklapper/types';
import gamesAutoStartError from '../../errors/games-auto-start-error';

/**
 * An action function for React Router DOM that registers players and starts a game.
 *
 * This function handles the process of registering a new game, adding players to it,
 * and initiating the game session. It performs the following steps:
 *  1. Registers the game with the server.
 *  2. Stores the game instance ID in session storage.
 *  3. Registers players for the game.
 *  4. Starts the game session.
 *  5. Redirects the user to the game page if successful, or to the games list page if an error occurs.
 *
 * @param {ActionFunctionArgs}  { request } - The request object containing the game name.
 * @returns {Promise<Response>} A redirect response to the game page or the games list page.
 */

const registerPlayersAndStartGame: ActionFunction = async ({ request }: ActionFunctionArgs) => {
  const gameName = await request.text();
  try {
    const gameInstanceID: string = await registerGame(gameName);

    sessionStorage.setItem('__current_game__', gameInstanceID);
    const __current_game__: GamePlayerValidation = JSON.parse(gameInstanceID);

    await registerPlayers(gameName, __current_game__);

    const resp = await startGame(gameName, __current_game__);

    if (resp.message === 'Game Started') {
      sessionStorage.setItem('playersIds', JSON.stringify(resp.playersInOrder));
      return redirect(gameName);
    } else {
      return redirect('/games');
    }
  } catch (error) {
    console.error(error);
    return gamesAutoStartError(`starting ${gameName}`);
  }
};

export default registerPlayersAndStartGame;
