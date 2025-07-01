import { Text, useScrollIntoView } from '@aklapper/react-shared';
import type { GameBoards, IActivePlayersInGame } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import { ReactElement, useReducer, useRef, useState } from 'react';
import { useParams } from 'react-router';
import type { ManagerOptions, Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import useGamesWebsockets from '../../hooks/useGamesWebsockets';
import Theme from '../../styles/themes/theme';
import { getGameInstanceInfo } from '../../utils/utils';
import ActiveAvatars from './game_board/active_avatars';
import GameBoard from './game_board/game_board.js';
import GameBoardTicTacToe from './game_board/game_board_tic_tac_toe';
import ResetGame from './game_board/reset_game';
import socketReducer from './game_board/socket-reducer';
import TakeTurnTicTacToe from './game_board/take-turn-tic-tac-toe';
import TakeTurn from './game_board/take_turn';

export interface IActiveGameInfo extends IActivePlayersInGame {
  gameBoard: GameBoards;
}

const socketInit = () => {
  return { gameBoard: [], activePlayersInGame: [], avatarInTurn: '', winner: '' } as IActiveGameInfo;
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

const wsURL = import.meta.env.VITE_GAMES_WS_URL + '/gameplay';

const ActiveGameSession = (): ReactElement => {
  const socketManagerOptions: Partial<ManagerOptions> = {
    autoConnect: false,
    extraHeaders: { 'current-game': JSON.stringify(getGameInstanceInfo()) },
    path: import.meta.env.VITE_GAMES_WS_PATH,
  };

  const clientSocket = io(wsURL, socketManagerOptions);
  const socketRef = useRef<Socket>(clientSocket);
  const [state, dispatch] = useReducer(socketReducer, {}, socketInit);
  const [space, setSpace] = useState<string | undefined>();
  const devRef = useRef<HTMLDivElement>(null);
  const { id } = useParams() as { id: string };

  const socket = socketRef.current;

  useScrollIntoView(devRef);

  useGamesWebsockets(socket, id, dispatch);

  return (
    <Box id={`active-${id}-game`}>
      <Box
        as={'section'}
        id='active-avatar-wrapper'
        sx={{
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <ActiveAvatars avatarsInGame={state.activePlayersInGame} winner={state.winner} />
      </Box>
      <Box ref={devRef} as={'section'} id='game-board-wrapper' sx={{ display: 'flex', height: '100%' }}>
        {id === 'Chutes-&-Ladders' ? (
          <GameBoard board={state.gameBoard} />
        ) : (
          <GameBoardTicTacToe board={state.gameBoard} setStateAction={setSpace} state={space} />
        )}
        <Box
          id='active-game-buttons-wrapper'
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            flex: '0 1 5%',
            padding: Theme.spacing(4),
            justifyContent: 'center',
          }}
        >
          <Text
            variant='h2'
            children={state.avatarInTurn}
            sx={{ textOrientation: 'upright', writingMode: 'vertical-rl', justifySelf: 'center', height: '70%' }}
          />
          <Box as={'section'} sx={{ display: 'flex', flexWrap: 'wrap', flex: '0 1 30%', gap: Theme.spacing(8) }}>
            {id === 'Chutes-&-Ladders' ? (
              <TakeTurn
                avatarInTurn={state.avatarInTurn as string}
                dispatch={dispatch}
                socket={socket}
                winner={state.winner}
              />
            ) : (
              <TakeTurnTicTacToe
                avatarInTurn={state.avatarInTurn as string}
                dispatch={dispatch}
                socket={socket}
                position={space}
                winner={state.winner}
              />
            )}
            <ResetGame dispatch={dispatch} socket={socket} setSpace={setSpace} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
export default ActiveGameSession;
