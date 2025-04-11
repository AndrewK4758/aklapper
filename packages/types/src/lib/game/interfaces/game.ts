import type { AllGameTypes } from '../types/all-games-types.js';
import type { Color, SpaceType } from '../types/game.js';
import type { IPlayer } from './player.js';

export interface IGame {
  instance: AllGameTypes;
  playersArray: IPlayer[];
  playerInTurn: IPlayer;
  readyToPlay: boolean;
  haveWinner: boolean;
  currentPlayer: number;

  verifyReadyToPlay(MIN_PLAYERS: number, MAX_PLAYERS: number): boolean;
  rotatePlayers(): void;
  wonGame(type: SpaceType): boolean;
  register(playerName: string, playerID: string, avatarName: string, avatarColor: Color): void;
}
