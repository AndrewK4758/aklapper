import { Text, useScrollIntoView } from '@aklapper/react-shared';
import { ClientSocket } from '@aklapper/socket-io-client';
import { GameBoard, IActivePlayersInGame } from '@aklapper/types-game';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import { useReducer, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ManagerOptions, Socket } from 'socket.io-client';
import useGamesWebsockets from '../../hooks/useGamesWebsockets';
import {
  breakpointsBottomMenuButtonsBox,
  breakpointsBottomMenuGameBoard,
  breakpointsPlayerInTurnText,
  gamesPaperSxProps
} from '../../styles/games-styles';
import getGameInstanceInfo from '../../utils/utils';
import ActiveAvatars from './game_board/active_avatars';
import ResetGame from './game_board/reset_game';
import ShowGameBoardTicTacToe from './game_board/show-game-board-tic-tac-toe';
import ShowGameBoard from './game_board/show_game_board';
import socketReducer from './game_board/socket-reducer';
import TakeTurnTicTacToe from './game_board/take-turn-tic-tac-toe';
import TakeTurn from './game_board/take_turn';

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
 *
 * - **Establishing a Websocket Connection:** Connects to the game server using `socket.io-client`,
 *   sending game instance information in the headers.
 * - **Joining a Game Room:** Emits a `create-room` event to join a specific game room
 *   based on the game instance ID.
 * - **Fetching Game Data:** Emits an `action` event to request the initial game board data.
 * - **Real-time Updates:** Listens for `game-data` events from the server to update the game board,
 *   active players, and the current player's turn in real-time.
 * - **Displaying Game Elements:**
 *   - Renders the game board using `ShowGameBoard` or `ShowGameBoardTicTacToe` based on the game type.
 *   - Shows active player avatars using `ActiveAvatars`.
 *   - Provides buttons for taking turns (`TakeTurn` or `TakeTurnTicTacToe`) and resetting the game (`ResetGame`).
 * - **Error Handling:** Listens for `no-game-error` events to handle potential game session errors.
 * - **Disconnecting:** Disconnects from the websocket server and removes all listeners
 *   when the component unmounts.
 *
 * @returns {JSX.Element} The rendered active game session component.
 */

const ActiveGameSession = (): JSX.Element => {
  const socketManagerOptions: Partial<ManagerOptions> = {
    autoConnect: false,
    extraHeaders: { 'current-game': JSON.stringify(getGameInstanceInfo()) }
  };

  const clientSocket = new ClientSocket(import.meta.env.VITE_GAMES_WS_URL, socketManagerOptions);
  const socketRef = useRef<Socket>(clientSocket.clientIo);
  const [state, dispatch] = useReducer(socketReducer, {}, socketInit);
  const [space, setSpace] = useState<string | undefined>();
  const divRef = useRef<HTMLDivElement>(null);
  const { id } = useParams() as { id: string };

  const socket = socketRef.current;

  useScrollIntoView(divRef);

  useGamesWebsockets(socket, id, dispatch);

  return (
    <Paper key={`active-${id}-game`} id={`active-${id}-game`} sx={gamesPaperSxProps}>
      <Box
        ref={divRef}
        component={'section'}
        key={`${id}-active-avatar-wrapper`}
        id="active-avatar-wrapper"
        display={'flex'}
        justifyContent={'center'}
      >
        <ActiveAvatars avatarsInGame={state.activePlayersInGame} winner={state.winner} />
      </Box>

      <Box
        component={'section'}
        key={`${id}-game-board-wrapper`}
        id="game-board-wrapper"
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
        id="active-game-buttons-wrapper"
        sx={breakpointsBottomMenuGameBoard}
      >
        <Text component={'h2'} titleVariant="h2" titleText={state.avatarInTurn} sx={breakpointsPlayerInTurnText} />
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
