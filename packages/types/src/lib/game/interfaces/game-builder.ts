import type { Command } from './chain.js';
import type { IBuiltGame } from './built-game.js';

export interface IGameBuilder {
  setId(id: string): IGameBuilder;
  setName(name: string): IGameBuilder;
  setDescription(description: string): IGameBuilder;
  setImageURL(imageURL: string): IGameBuilder;
  setRule(order: number, value: string, title: string): IGameBuilder;
  setGameFunctionality(commands: Command[], continueOnError: boolean): IGameBuilder;
  setInstance<T>(instance: () => T): IGameBuilder;
  build(): IBuiltGame;
}
