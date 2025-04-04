import type { IBuiltGame } from './built-game.js';
import type { Command } from './chain.js';

export interface IGameBuilder {
  Game: IBuiltGame;
  setId(id: string): IGameBuilder;
  setName(name: string): IGameBuilder;
  setDescription(description: string): IGameBuilder;
  setImageURL(imageURL: string): IGameBuilder;
  setRule(order: number, value: string, title: string): IGameBuilder;
  setGameFunctionality(commands: Command[], continueOnError: boolean): IGameBuilder;
  setInstance<T>(instance: () => T): IGameBuilder;
  setPlayers(min: number, max: number): IGameBuilder;
  build(): IBuiltGame;
}
