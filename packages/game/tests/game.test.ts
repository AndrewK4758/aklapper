import { Die, Player, Space } from '@aklapper/games-components';
import {
  Color,
  SpaceType,
  type AllGameTypes,
  type AvatarTotem,
  type IDie,
  type ILiteSpace,
  type ISpace,
} from '@aklapper/types';

import Game from '../src/lib/game.js';

let game: Game, instance: TestGame, playerInTurn: Player;

class TestGame implements AllGameTypes {
  NAME: 'TEST GAME';
  MAX_PLAYERS: number;
  MIN_PLAYERS: number;
  CHUTES: number;
  LADDERS: number;
  DIE: IDie;
  startSpace: ISpace;
  endSpace: ISpace;
  colorList: typeof Color;
  avatarList: AvatarTotem[];
  constructor() {
    this.MIN_PLAYERS = 2;
    this.MAX_PLAYERS = 4;
    this.NAME = 'TEST GAME';
    this.CHUTES = 5;
    this.LADDERS = 5;
    this.DIE = new Die(6);
    this.startSpace = new Space(SpaceType.START, 'START');
    this.endSpace = new Space(SpaceType.FINISH, 'FINISH');
    this.colorList = Color;
    this.avatarList = [
      {
        id: 0,
        image: 'image0',
        name: 'NAME 0',
      },
      {
        id: 1,
        image: 'image1',
        name: 'NAME 1',
      },
    ];
  }
  makeGameBoard(): void {
    return;
  }
  displayGameBoard(): ILiteSpace[] {
    return [];
  }
}

describe('Test the game class', () => {
  beforeAll(() => {
    instance = new TestGame();
    game = new Game(instance);
  });
  afterAll(() => {
    game.playersArray = [];
    game.currentPlayer = 0;
  });
  describe('test properties of game class', () => {
    it('should verify instance prop is of type chutes and ladders', () => {
      expect(game.instance).toBeTruthy();
    });
    it('should verify 1 player is in the player array', () => {
      game.register('player-1', 'player', game.instance.avatarList[0].name, Color.WHITE);

      playerInTurn = game.playersArray[0];
      expect(game.playersArray.length).toEqual(1);
    });
    it('should set current player to first player in players array', () => {
      game.playerInTurn = game.playersArray[game.currentPlayer];

      expect(game.currentPlayer).toEqual(0);
      expect(game.playerInTurn.id).toEqual('player');
    });
    it('should verify the ready to play prop is false', () => {
      const status = game.verifyReadyToPlay(instance.MIN_PLAYERS, instance.MAX_PLAYERS);

      expect(status).toEqual(false);
    });

    it('should verify the ready to play prop is true', () => {
      game.register('player-2', 'reyalp', game.instance.avatarList[1].name, Color.RED);
      const status = game.verifyReadyToPlay(instance.MIN_PLAYERS, instance.MAX_PLAYERS);
      expect(status).toEqual(true);
    });

    it('should change the current player prop to 1 index in player array', () => {
      const p2: Player = game.playersArray[1];

      expect(game.playerInTurn).toEqual(playerInTurn);

      game.rotatePlayers();

      expect(game.playerInTurn).toEqual(p2);
    });

    it('should return true when finish space is passed into won game method', () => {
      const space = new Space(SpaceType.FINISH, 'FINISH');
      const status = game.wonGame(space.type);
      expect(status).toEqual(true);
    });
  });
});
