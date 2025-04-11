import { ChainBuilder } from '@aklapper/chain';
import type { Command, IBuiltGame, IGameBuilder } from '@aklapper/types';
import { Rule } from '../rule/rule.js';

export class GameBuilder implements IGameBuilder {
  Game: IBuiltGame;
  constructor() {
    this.Game = new Object() as IBuiltGame;
    this.Game.rules = [];
  }

  setId(id: string): IGameBuilder {
    this.Game.id = id;
    return this;
  }

  setName(name: string): IGameBuilder {
    this.Game.name = name;
    return this;
  }

  setDescription(description: string): IGameBuilder {
    this.Game.description = description;
    return this;
  }

  setPlayers(min: number, max: number): IGameBuilder {
    const players = {
      min: min,
      max: max,
    };
    this.Game.players = players;

    return this;
  }

  setImageURL(imageURL: string): IGameBuilder {
    this.Game.imageURL = imageURL;
    return this;
  }

  setRule(order: number, title: string, value: string): IGameBuilder {
    const rule = new Rule().setOrder(order).setValue(value).setTitle(title).build();
    this.Game.rules.push(rule);
    return this;
  }

  setGameFunctionality(commands: Command[], continueOnError: boolean): IGameBuilder {
    this.Game.chain = ChainBuilder.build(commands, continueOnError);
    return this;
  }

  setInstance<T>(instance: () => T): IGameBuilder {
    this.Game.instance = instance;
    return this;
  }

  build(): IBuiltGame {
    const gameBuildComplete = Object.assign(new Object() as IBuiltGame, this.Game);
    this.Game = {} as IBuiltGame;
    this.Game.rules = [];
    this.Game.chain = null;
    this.Game.players = { min: 0, max: 0 };
    this.Game.instance = () => null;

    return gameBuildComplete;
  }
}
