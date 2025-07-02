import { rowFinder } from '@aklapper/games-components';
import type { GameBoards, GamePlayerValidation, ILiteSpace, IPlayersAndBoard, Row } from '@aklapper/types';
import { useCallback, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import type { IActiveGameInfo } from '../components/games/active_game_session.js';
import { Action } from '../components/games/game_board/socket-reducer.js';
import { getGameInstanceInfo } from '../utils/utils.js';

/**
 * Connects to a Socket.IO server and handles game-related events to update the game state.
 * It listens for 'game-data' events, which are emitted when the game starts or a player makes a move,
 * and updates the UI accordingly.
 *
 * @param {Socket} socket - The Socket.IO client instance.
 * @param {string} id - The game room ID.
 * @param {Function} dispatch - The React dispatch function.
 * @returns {void}
 */

const useGamesWebsockets = (socket: Socket, id: string, dispatch: (value: Action) => void): void => {
  const processGame = useCallback(
    (
      { gameBoard, activePlayersInGame, winner, avatarInTurn }: IPlayersAndBoard,
      id: string,
      dispatch: (value: Action) => void,
    ) => processGameData({ gameBoard, activePlayersInGame, winner, avatarInTurn }, id, dispatch),
    [],
  );

  useEffect(() => {
    if (!socket.connected) socket.connect();

    socket.on('connect', () => {
      console.log(`Player connected with ID: ${socket.id}`);
    });

    socket.emit('create-room', (getGameInstanceInfo() as GamePlayerValidation).gameInstanceID);

    socket.emit('action', { action: Action.BOARD });

    socket.on('game-data', async ({ gameBoard, activePlayersInGame, winner, avatarInTurn }: IPlayersAndBoard) => {
      processGame({ gameBoard, activePlayersInGame, winner, avatarInTurn }, id, dispatch);
    });

    socket.on('no-game-error', ({ errorMessage }) => {
      console.error(errorMessage);
    });

    socket.on('disconnect', () => {
      console.log('disconnecting');
    });

    return () => {
      socket.disconnect();
      socket.removeAllListeners();
    };
  }, []);
};

export default useGamesWebsockets;

const processGameData = (
  { gameBoard, activePlayersInGame, winner, avatarInTurn }: IPlayersAndBoard,
  id: string,
  dispatch: (value: Action) => void,
) => {
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
    type: Action.BOARD,
    payload: { gameBoard: gameBoardClient, activePlayersInGame, avatarInTurn, winner } as IActiveGameInfo,
  });
};
