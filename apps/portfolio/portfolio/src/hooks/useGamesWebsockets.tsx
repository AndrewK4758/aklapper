import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import getGameInstanceInfo from '../utils/utils';
import type { GameBoard, GamePlayerValidation, ILiteSpace, IPlayersAndBoard, Row } from '@aklapper/types-game';
import { ActionType, type Action } from '../components/games/game_board/socket-reducer';
import { rowFinder } from '@aklapper/games-components';
import type { IActiveGameInfo } from '../components/games/active_game_session';

const useGamesWebsockets = (socket: Socket, id: string, dispatch: (value: Action) => void) => {
  useEffect(() => {
    if (!socket.connected) socket.connect();

    socket.on('connect', () => {
      console.log(`Player connected with ID: ${socket.id}`);
    });

    socket.emit('create-room', (getGameInstanceInfo() as GamePlayerValidation).gameInstanceID);
  });

  useEffect(() => {
    socket.emit('action', { action: ActionType.BOARD });

    socket.on('game-data', async ({ gameBoard, activePlayersInGame, winner, avatarInTurn }: IPlayersAndBoard) => {
      const gameBoardClient: GameBoard = [];
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
        payload: { gameBoard: gameBoardClient, activePlayersInGame, avatarInTurn, winner } as IActiveGameInfo
      });
    });
    socket.on('no-game-error', ({ errorMessage }) => {
      console.error(errorMessage);
    });
    return () => {
      socket.disconnect();
      socket.removeAllListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
};

export default useGamesWebsockets;
