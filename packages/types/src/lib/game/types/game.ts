import type { Request, Response } from 'express';
import type { Namespace } from 'socket.io';
import type { IInstanceOfGame } from '../interfaces/instance-of-game.js';
import type { ILiteSpace } from '../interfaces/lite-space.js';
import type { IPlayer } from '../interfaces/player.js';

export enum Color {
  UNDEFINED = '',
  RED = 'Red',
  WHITE = 'White',
  BLUE = 'Blue',
  GREEN = 'Green',
  PURPLE = 'Purple',
  YELLOW = 'Yellow',
  ORANGE = 'Orange',
  PINK = 'Pink',
  BLACK = 'Black',
  BROWN = 'Brown',
}

export enum SpaceType {
  START,
  NORMAL,
  CHUTE,
  LADDER,
  FINISH,
}

export type ContextData = {
  action: string;
  game: IInstanceOfGame;
  req: Request;
  resp: Response;
  next: string;
  output: object;
  io: Namespace;
};

export enum GameContextKeys {
  GAME = 'GAME',
  REQUEST = 'REQUEST',
  RESPONSE = 'RESPONSE',
  ACTION = 'ACTION',
  NEXT = 'NEXT-HANDLER',
  OUTPUT = 'OUT',
  IO = 'IO',
}

export enum TurnStatus {
  VALID = 'VALID PLAYER',
  INVALID = 'INVALID PLAYER',
  NOT_READY = 'GAME NOT READY',
  GAME_WON = 'GAME WON',
  NULL_SELECT = 'NOTHING SELECTED',
}

export type AvatarTotem = {
  id: number;
  name: string;
  image: string;
};

export type Minute = number;

export type GameInstanceID = string;

export type PlayerID = string;

export type GamesInMinute = GameInstanceID[];

export type GameNameString = string;

export type GamePlayerValidation = {
  gameInstanceID?: GameInstanceID;
  playerID?: string;
};

export type PlayerInTurn = {
  playerInTurn: string;
  playerInTurnID: string;
};

export interface ILoadRegisterData {
  avatarList: AvatarTotem[];
  avatarColorList: typeof Color;
}

export interface IRegisterLoaderAndFilter extends ILoadRegisterData {
  gamePlayerIDs: GamePlayerValidation;
}

export type IRegisterFormValues = {
  playerName: string;
  avatarName: string;
  avatarColor: Color;
  avatarImage?: string;
};

export interface IActivePlayersInGame {
  activePlayersInGame: IRegisterFormValues[];
  avatarInTurn: string;
  winner?: string;
}

export interface ITestCtxOutput {
  message: string;
}

export interface IPlayersAndBoard extends IActivePlayersInGame {
  gameBoard: ILiteSpace[];
}

type PrivateMessageTargetDetails = {
  targetId: string;
  targetName: string;
};

type PrivateMessageSenderDetails = {
  senderName: string;
  senderId: string;
};

export type PrivateMessageDetails = {
  target: PrivateMessageTargetDetails;
  message: string;
  sender: PrivateMessageSenderDetails;
};

export type SocketID = string;

export type GamesInLobbyPending = {
  [gameName: string]: Partial<IInstanceOfGame>[];
};

export type NewGameDetails = {
  gameName: GameNameString; // Name of new game being created
  gameId: GameInstanceID; // Id of new game being created
  gamesInLobby: GamesInLobbyPending[]; // All games in the lobby that are created and waiting for players or start
};

export type ClientLobbyData = {
  activeGamesInLobby: GamesInLobbyPending[];
  activePlayersInLobby: IPlayer[];
};

export interface IGamesInLobby {
  games: Map<GameNameString, IInstanceOfGame[]>;
}

export type NewGameCall = { gamesInLobby: GamesInLobbyPending[]; gameInstanceId: GameInstanceID };

export type ActivePlayerMap = Map<string, IPlayer>;

export interface IActivePlayers {
  _Map: ActivePlayerMap;

  get map(): ActivePlayerMap;

  addPlayer(id: string, player: IPlayer): void;

  getPlayer(id: string): IPlayer;

  deletePlayerFromLobby(id: string): void;
}
