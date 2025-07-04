import type { GameBoards, IActivePlayersInGame } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import { ReactElement, useReducer } from 'react';

import { css } from '@pigment-css/react';
import ActiveAvatars from './game_board/active_avatars';
import GameBoardAndActions from './game_board/game_boards';
import socketReducer from './game_board/socket-reducer';

export interface IActiveGameInfo extends IActivePlayersInGame {
  gameBoard: GameBoards;
  space: string | undefined;
}

const socketInit = (): IActiveGameInfo => {
  return { gameBoard: [], activePlayersInGame: [], avatarInTurn: '', winner: '', space: undefined };
};

/**
 * Renders the active game session component.
 *
 * This component manages the real-time interaction and display of a game session
 * using websockets. It handles:
 *   - Initializing the game board and player state.
 *   - Updating the game board and player state based on server events.
 *   - Rendering the game board, active players, turn information, and move controls.
 *
 * @returns {ReactElement} The rendered active game session component.
 */

const ActiveGameSession = (): ReactElement => {
  const [state, dispatch] = useReducer(socketReducer, {}, socketInit);

  return (
    <Box id={`active-game-session`}>
      <Box
        as={'section'}
        id='active-avatar-wrapper'
        className={css({
          display: 'flex',
          justifyContent: 'center',
        })}
      >
        <ActiveAvatars avatarsInGame={state.activePlayersInGame} winner={state.winner} />
      </Box>
      <GameBoardAndActions state={state} dispatch={dispatch} />
    </Box>
  );
};
export default ActiveGameSession;
