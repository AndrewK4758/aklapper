import { rowFinder } from '@aklapper/games-components';
import { Text } from '@aklapper/react-shared';
import type { GameBoards, IActivePlayersInGame, ILiteSpace, IPlayersAndBoard, Row } from '@aklapper/types';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import type { SxProps } from '@mui/material/styles';
import { useEffect, useReducer, useRef, useState } from 'react';
import { useParams } from 'react-router';
import type { ManagerOptions, Socket } from 'socket.io-client';
import ActiveAvatars from '../components/game_board/active_avatars';
import ReadyToStart from '../components/game_board/ready_to_start_button';
import ResetGame from '../components/game_board/reset_game';
import ShowGameBoardTicTacToe from '../components/game_board/show-game-board-tic-tac-toe';
import ShowGameBoard from '../components/game_board/show_game_board';
import socketReducer, { ActionType } from '../components/game_board/socket-reducer';
import TakeTurnTicTacToe from '../components/game_board/take-turn-tic-tac-toe';
import TakeTurn from '../components/game_board/take_turn';
import { GamesTheme as Theme } from '../styles/games-theme';
import getGameInstanceInfo from '../utils/utils';
import ClientSocket from '../utils/web-socket/socket-instance';

const breakpointsBottomMenuGameBoard: SxProps = {
  marginTop: '2rem',
  flexDirection: 'row',
  [Theme.breakpoints.down('md')]: {
    marginTop: '1rem',
  },
};

const breakpointsPlayerInTurnText: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '1em',
  },
};

const breakpointsBottomMenuButtonsBox: SxProps = {
  flex: '1 0 50%',
  flexDirection: 'row',
  [Theme.breakpoints.down('md')]: {
    flexDirection: 'column',
  },
};

export type Built_GameBoard = GameBoards[];

export interface IActiveGameInfo extends IActivePlayersInGame {
  gameBoard: GameBoards;
}

const socketInit = () => {
  return { gameBoard: [[]], activePlayersInGame: [], avatarInTurn: '', winner: '' } as IActiveGameInfo;
};

const wsUrl = import.meta.env.VITE_WS_SERVER_URL;

const ActiveGameSession = () => {
  console.log('active game session');
  const managerOptions: Partial<ManagerOptions> = {
    autoConnect: false,
    extraHeaders: { 'current-game': JSON.stringify(getGameInstanceInfo()) },
  };

  const clientSocket = new ClientSocket(wsUrl, managerOptions);
  const [state, dispatch] = useReducer(socketReducer, {}, socketInit);
  const [space, setSpace] = useState<string | undefined>(undefined);
  const socketRef = useRef<Socket>(clientSocket.Socket);
  const params = useParams();

  const id = params.id;

  const socket = socketRef.current;

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
      socket.on('connect', () => {
        console.log(`Player connected with ID: ${socket.id}`);
      });
    }
    socket.emit('create-room', getGameInstanceInfo()?.gameInstanceID);
  });

  useEffect(() => {
    socket.emit('action', { action: ActionType.BOARD });
    socket.on('game-data', ({ gameBoard, activePlayersInGame, winner, avatarInTurn }: IPlayersAndBoard) => {
      const gameBoardClient: GameBoards = [];
      const maxRowLength = Math.sqrt(gameBoard.length);
      let indexOfSpace = 1;
      let row: Row = [];
      gameBoard.forEach((s: ILiteSpace) => {
        const rowCount = rowFinder(indexOfSpace, gameBoard.length);
        row.push(s);

        if (row.length === maxRowLength) {
          if (id === 'Chutes-&-Ladders') {
            row = rowCount % 2 !== 0 ? row : row.reverse();
          }
          gameBoardClient.push(row);
          row = [];
        }
        indexOfSpace++;
      });

      dispatch({
        type: ActionType.BOARD,
        payload: { gameBoard: gameBoardClient, activePlayersInGame, avatarInTurn, winner } as IActiveGameInfo,
      });
    });
    socket.on('no-game-error', ({ errorMessage }) => {
      console.error(errorMessage);
    });

    return () => {
      if (socket.connected) {
        socket.disconnect();
        socket.removeAllListeners();
      }
    };
  }, [id, socket]);

  return (
    <>
      <Container component={'section'} sx={{ marginBottom: '2rem' }}>
        <ActiveAvatars avatarsInGame={state.activePlayersInGame} winner={state.winner} />
        <ReadyToStart dispatch={dispatch} socket={socket} />
      </Container>
      <Box
        component={'section'}
        id='game-board-display-wrapper'
        sx={{
          minHeight: '55vh',
          height: 'fit-content',
          border: `5px solid ${Theme.palette.success.main}`,
          [Theme.breakpoints.up('md')]: {
            boxShadow: `0px 7px 8px -4px ${Theme.palette.success.main}, 0px 12px 17px 2px ${Theme.palette.primary.light}, 0px 5px 22px 4px ${Theme.palette.primary.dark}, 0px -7px 8px -4px ${Theme.palette.success.main}, 0px -12px 17px 2px ${Theme.palette.primary.light}, 0px -5px 22px 4px ${Theme.palette.primary.dark}`,
          },
        }}
      >
        {id === 'Chutes-&-Ladders' && <ShowGameBoard board={state.gameBoard} />}
        {id === 'Tic-Tac-Toe' && (
          <ShowGameBoardTicTacToe board={state.gameBoard} setStateAction={setSpace} state={space} />
        )}
      </Box>
      <Container id='Bottom of Game' component={'section'} sx={breakpointsBottomMenuGameBoard}>
        <Box component={'div'} sx={{ flex: '1 0 50%' }}>
          <Text variant='h2' children={state.avatarInTurn} sx={breakpointsPlayerInTurnText} />
        </Box>
        <Container component={'section'} sx={breakpointsBottomMenuButtonsBox}>
          {id === 'Chutes-&-Ladders' && <TakeTurn dispatch={dispatch} socket={socket} />}
          {id === 'Tic-Tac-Toe' && <TakeTurnTicTacToe dispatch={dispatch} socket={socket} position={space} />}
          <ResetGame dispatch={dispatch} socket={socket} />
        </Container>
      </Container>
    </>
  );
};

export default ActiveGameSession;
