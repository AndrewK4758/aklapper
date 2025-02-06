import type { Server } from 'socket.io';
import { GameContextKeys } from '../types/game.js';
import type { IInstanceOfGame } from './instance-of-game.ts';
import type { Request, Response } from 'express';

export type Context<K extends GameContextKeys | string> = {
  state: Map<K, GameContextState[K] | unknown>;
  put: <Key extends K>(key: Key, value: GameContextState[Key]) => void;
  get: <Key extends K>(key: Key) => GameContextState[Key] | unknown;
  getString: <Key extends K>(key: Key) => string;
  getNumber: <Key extends K>(key: Key) => number;
};

export interface Command {
  execute: <T extends GameContextKeys | string>(context: Context<T>) => boolean;
}

export interface Chain extends Command {
  getCommands(): Command[];
}

export interface GameContextState {
  [GameContextKeys.ACTION]: string;
  [GameContextKeys.GAME]: IInstanceOfGame;
  [GameContextKeys.IO]: Server;
  [GameContextKeys.NEXT]: string;
  [GameContextKeys.OUTPUT]: unknown;
  [GameContextKeys.REQUEST]: Request;
  [GameContextKeys.RESPONSE]: Response;
  [key: string]: unknown;
}
