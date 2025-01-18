import { Color, SpaceType } from '../types/game.ts';
import { IPlayer } from './player.ts';
import { AllGameTypes } from '../types/all-games-types.ts';

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
