import { rowFinder } from '@aklapper/games-components';
import type {
  GameBoards,
  GameInstanceID,
  GamePlayerValidation,
  ILiteSpace,
  IPlayersAndBoard,
  Row,
} from '@aklapper/types';
import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { Action } from '../components/games/game_board/socket-reducer';
import { getGameInstanceInfo } from '../utils/utils';

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

type AvatarLocation = {
  spaceDisplay: string;
  location: string | number;
};

type IAvatarsLocations = {
  p1: AvatarLocation;
  p2: AvatarLocation;
};

const useGamesWebsockets = (socket: Socket, id: string, dispatch: (action: Action) => void): IAvatarsLocations => {
  const [avatarsLocations, setAvatarsLocations] = useState<IAvatarsLocations>({
    p1: { spaceDisplay: '', location: '' },
    p2: { spaceDisplay: '', location: '' },
  });

  const handleUpdateAvatarsLocations = useCallback((newLocation: IAvatarsLocations) => {
    setAvatarsLocations(newLocation);
  }, []);
  // const processGame = useCallback((gameData: IPlayersAndBoard, id: string) => processGameData(gameData, id), []);

  useEffect(() => {
    const gameID = (getGameInstanceInfo() as GamePlayerValidation).gameInstanceID as GameInstanceID;
    if (!socket.connected) socket.connect();

    socket.on('connect', () => {
      console.log(`Player connected with ID: ${socket.id}`);
    });

    socket.emit('create-room', gameID);

    socket.emit('action', { action: Action.BOARD, gameID: gameID });

    socket.on('game-data', async (gameData: IPlayersAndBoard) => {
      const clientGameBoard = processGameData(gameData, id, handleUpdateAvatarsLocations);

      dispatch({
        type: Action.BOARD,
        payload: { ...gameData, gameBoard: clientGameBoard, space: undefined },
      });
    });

    socket.on('no-game-error', ({ errorMessage }) => {
      console.error(errorMessage);
    });

    socket.on('error', err => {
      console.error(err);
    });

    socket.on('disconnect', () => {
      console.log('disconnecting');
    });

    return () => {
      socket.disconnect();
      socket.removeAllListeners();
    };
  }, []);

  return avatarsLocations;
};

export default useGamesWebsockets;

const processGameData = (
  { gameBoard, activePlayersInGame }: IPlayersAndBoard,
  id: string,
  setAvatarsLocations: (avatarsLocations: IAvatarsLocations) => void,
) => {
  const gameBoardClient: GameBoards = [];
  const maxRowLength = Math.sqrt(gameBoard.length);

  let indexOfSpace = 1;
  let row: Row = [];

  gameBoard.forEach((s: ILiteSpace) => {
    if (s.occupied) {
      console.log(s);
      activePlayersInGame.forEach(e => console.log(e));
      const player = activePlayersInGame.find(player => player.avatarImage === s.display);
      console.log(player);
      const p1: AvatarLocation = {
        location: '',
        spaceDisplay: s.defaultDisplayName,
      };
      const p2: AvatarLocation = {
        location: '',
        spaceDisplay: s.defaultDisplayName,
      };

      setAvatarsLocations({ p1, p2 });
    }
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

  return gameBoardClient;
};
