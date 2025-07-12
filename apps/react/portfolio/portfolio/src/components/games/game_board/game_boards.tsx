import { Text, useScrollIntoView } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import { css } from '@pigment-css/react';
import { useRef, type ActionDispatch } from 'react';
import { useParams } from 'react-router';
import type { ManagerOptions, Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import useGamesWebsockets from '../../../hooks/useGamesWebsockets';
import Theme from '../../../styles/themes/theme';
import type { IActiveGameInfo } from '../../../types/types';
import { getGameInstanceInfo } from '../../../utils/utils';
import GameBoard from './game_board.js';
import GameBoardTicTacToe from './game_board_tic_tac_toe';
import ResetGame from './reset_game';
import type { Action } from './socket-reducer';
import TakeTurnTicTacToe from './take-turn-tic-tac-toe';
import TakeTurn from './take_turn';

interface GameBoardAndActionsProps {
  dispatch: ActionDispatch<[action: Action]>;
  state: IActiveGameInfo;
}

const wsURL = import.meta.env.VITE_GAMES_WS_URL + import.meta.env.VITE_GAMES_WS_GAMEPLAY_NAMESPACE;

const GameBoardAndActions = function ({ state, dispatch }: GameBoardAndActionsProps) {
  const socketManagerOptions: Partial<ManagerOptions> = {
    autoConnect: false,
    extraHeaders: { 'current-game': JSON.stringify(getGameInstanceInfo()) },
    path: import.meta.env.VITE_GAMES_WS_PATH,
  };

  const clientSocket = io(wsURL, socketManagerOptions);
  const socketRef = useRef<Socket>(clientSocket);
  const devRef = useRef<HTMLDivElement>(null);
  const { id } = useParams() as { id: string };
  const socket = socketRef.current;
  useScrollIntoView(devRef);
  useGamesWebsockets(socket, id, dispatch);
  return (
    <Box
      ref={devRef}
      component={'section'}
      id='game-board-wrapper'
      sx={{ display: 'flex', height: '100%', maxHeight: '100%' }}
    >
      {id === 'Chutes-&-Ladders' ? (
        <GameBoard board={state.gameBoard} />
      ) : (
        <GameBoardTicTacToe state={state} dispatch={dispatch} />
      )}
      <Box
        id='active-game-buttons-wrapper'
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          flex: '0 1 5%',
          padding: Theme.spacing(4),
          justifyContent: 'center',
        })}
      >
        <Text
          variant='h2'
          children={state.avatarInTurn}
          className={css({
            textOrientation: 'upright',
            writingMode: 'vertical-rl',
            justifySelf: 'center',
            height: '70%',
          })}
        />
        <Box
          component={'section'}
          className={css({ display: 'flex', flexWrap: 'wrap', flex: '0 1 30%', gap: Theme.spacing(8) })}
        >
          {id === 'Chutes-&-Ladders' ? (
            <TakeTurn state={state} dispatch={dispatch} socket={socket} />
          ) : (
            <TakeTurnTicTacToe state={state} dispatch={dispatch} socket={socket} />
          )}
          <ResetGame dispatch={dispatch} socket={socket} state={state} />
        </Box>
      </Box>
    </Box>
  );
};

export default GameBoardAndActions;
