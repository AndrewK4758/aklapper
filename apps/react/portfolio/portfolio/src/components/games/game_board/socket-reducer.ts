import { Socket } from 'socket.io-client';
import type { IActiveGameInfo } from '../../../types/types';

export type ActionType = (typeof Action)[keyof typeof Action];

export const Action = Object.freeze({
  BOARD: 'board',
  TAKE_TURN: 'take-turn',
  START: 'start',
  RESET: 'reset',
  SPACE: 'space',
});

export interface Action {
  type: ActionType;
  payload: IActiveGameInfo;
  socket?: Socket;
}
/**
 * This is a reducer function that manages the state of the ActiveGameSession component.
 * It handles actions related to updating the game board, taking turns, starting and resetting the game.
 *
 * @param {IActiveGameInfo} state - The current state of the ActiveGameSession component.
 * @param {Action} action - The action to be performed.
 * @returns {IActiveGameInfo} The updated state.
 */

export default function socketReducer(state: IActiveGameInfo, action: Action): IActiveGameInfo {
  const { type, socket } = action;
  switch (type) {
    case Action.BOARD: {
      const { gameBoard, activePlayersInGame, avatarInTurn, winner } = action.payload;
      return { ...state, gameBoard, activePlayersInGame, avatarInTurn, winner };
    }
    case Action.TAKE_TURN:
      if (socket) socket.emit('action', { action: Action.BOARD });
      return { ...state };
    case Action.START:
      if (socket) socket.emit('action', { action: Action.BOARD });
      return { ...state };
    case Action.RESET:
      if (socket) socket.emit('action', { action: Action.BOARD });
      return { ...state };
    case Action.SPACE: {
      const { space } = action.payload;
      return { ...state, space };
    }
    default:
      throw new Error('Error in reducer');
  }
}
