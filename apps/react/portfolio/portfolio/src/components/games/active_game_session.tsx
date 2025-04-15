import { Text, useScrollIntoView } from '@aklapper/react-shared';
import type { GameBoard, IActivePlayersInGame } from '@aklapper/types';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import { useReducer, useRef, useState, type JSX } from 'react';
import { useParams } from 'react-router';
import type { ManagerOptions, Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import useGamesWebsockets from '../../hooks/useGamesWebsockets.jsx';
import {
  breakpointsBottomMenuButtonsBox,
  breakpointsBottomMenuGameBoard,
  breakpointsPlayerInTurnText,
  gamesPaperSxProps,
} from '../../styles/games-styles.jsx';
import getGameInstanceInfo from '../../utils/utils.jsx';
import ActiveAvatars from './game_board/active_avatars.jsx';
import ResetGame from './game_board/reset_game.jsx';
import ShowGameBoardTicTacToe from './game_board/show-game-board-tic-tac-toe.jsx';
import ShowGameBoard from './game_board/show_game_board.jsx';
import socketReducer from './game_board/socket-reducer.jsx';
import TakeTurnTicTacToe from './game_board/take-turn-tic-tac-toe.jsx';
import TakeTurn from './game_board/take_turn.jsx';

export interface IActiveGameInfo extends IActivePlayersInGame {
  gameBoard: GameBoard;
}

const socketInit = () => {
  return { gameBoard: [[]], activePlayersInGame: [], avatarInTurn: '', winner: '' } as IActiveGameInfo;
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
 * @returns {JSX.Element} The rendered active game session component.
 */

const wsURL = import.meta.env.VITE_GAMES_WS_URL;

const ActiveGameSession = (): JSX.Element => {
  const socketManagerOptions: Partial<ManagerOptions> = {
    autoConnect: false,
    path: '/gameplay',
    extraHeaders: { 'current-game': JSON.stringify(getGameInstanceInfo()) },
  };

  const clientSocket = io(wsURL, socketManagerOptions);
  const socketRef = useRef<Socket>(clientSocket);
  const [state, dispatch] = useReducer(socketReducer, {}, socketInit);
  const [space, setSpace] = useState<string | undefined>();
  const divRef = useRef<HTMLDivElement>(null);
  const { id } = useParams() as { id: string };

  const socket = socketRef.current;

  useGamesWebsockets(socket, id, dispatch);

  useScrollIntoView(divRef);
  return (
    <Paper key={`active-${id}-game`} id={`active-${id}-game`} sx={gamesPaperSxProps}>
      <Box
        ref={divRef}
        component={'section'}
        key={`${id}-active-avatar-wrapper`}
        id='active-avatar-wrapper'
        display={'flex'}
        justifyContent={'center'}
      >
        <ActiveAvatars avatarsInGame={state.activePlayersInGame} winner={state.winner} />
      </Box>

      <Box
        component={'section'}
        key={`${id}-game-board-wrapper`}
        id='game-board-wrapper'
        sx={{ height: 'fit-content', textAlign: 'center', paddingX: 4 }}
      >
        {id === 'Chutes-&-Ladders' ? (
          <ShowGameBoard key={`chutes-and-ladders-full-game-board-wrapper`} board={state.gameBoard} />
        ) : (
          <ShowGameBoardTicTacToe
            key={'tic-tac-toe-full-game-board-wrapper'}
            board={state.gameBoard}
            setStateAction={setSpace}
            state={space}
          />
        )}
      </Box>

      <Container
        component={'section'}
        key={`${id}-active-game-buttons-wrapper`}
        id='active-game-buttons-wrapper'
        sx={breakpointsBottomMenuGameBoard}
      >
        <Text component={'h2'} titleVariant='h2' titleText={state.avatarInTurn} sx={breakpointsPlayerInTurnText} />
        <Box component={'section'} sx={breakpointsBottomMenuButtonsBox}>
          {id === 'Chutes-&-Ladders' ? (
            <TakeTurn avatarInTurn={state.avatarInTurn as string} dispatch={dispatch} socket={socket} />
          ) : (
            <TakeTurnTicTacToe
              avatarInTurn={state.avatarInTurn as string}
              dispatch={dispatch}
              socket={socket}
              position={space}
            />
          )}

          <ResetGame dispatch={dispatch} socket={socket} setSpace={setSpace} />
        </Box>
      </Container>
    </Paper>
  );
};

export default ActiveGameSession;
