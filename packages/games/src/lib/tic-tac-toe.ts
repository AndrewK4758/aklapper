import { Board, LiteSpace, Space } from '@aklapper/games-components';
import { Color, SpaceType, type AvatarTotem, type ILiteSpace, type ITicTacToe } from '@aklapper/types';
import AvatarTotemsTTT from './avatar-totems_tic-tac-toe.js';

export const WINNING_POSITIONS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['1', '4', '7'],
  ['2', '5', '8'],
  ['3', '6', '9'],
  ['1', '5', '9'],
  ['3', '5', '7'],
];
export const SPACES = 9;
export const GAME_ROWS = Math.sqrt(SPACES);

export class TicTacToe implements ITicTacToe {
  NAME: 'Tic Tac Toe';
  MIN_PLAYERS: number;
  MAX_PLAYERS: number;
  startSpace: Space;
  avatarList: AvatarTotem[];
  colorList: typeof Color;

  constructor() {
    this.NAME = 'Tic Tac Toe';
    this.MIN_PLAYERS = 2;
    this.MAX_PLAYERS = 2;
    this.startSpace = new Space(SpaceType.NORMAL, 1);
    this.makeGameBoard();
    this.colorList = Color;
    this.avatarList = AvatarTotemsTTT.totemsList;
  }

  makeGameBoard = () => {
    new Board(SPACES, this.spaceMaker);
  };

  spaceMaker = (indexOfSpace: number) =>
    indexOfSpace === 1 ? this.startSpace : new Space(SpaceType.NORMAL, indexOfSpace);

  addAvatarToDisplay = (name: string) => {
    switch (name) {
      case AvatarTotemsTTT.totemsList[0].name:
        return AvatarTotemsTTT.totemsList[0].image;
      case AvatarTotemsTTT.totemsList[1].name:
        return AvatarTotemsTTT.totemsList[1].image;
      default:
        throw Error('Avatar not in list');
    }
  };

  displayGameBoard = (): ILiteSpace[] => {
    const board: LiteSpace[] = [];
    let space = this.startSpace;
    let display;

    while (space) {
      if (space.occupied) {
        display = this.addAvatarToDisplay(space.avatarsInSpace[0].name);
      } else {
        display = space['display'];
      }
      const liteSpace = LiteSpace.MakeSpace(display);

      board.push(liteSpace);
      space = space.next;
    }
    return board;
  };
}

export default TicTacToe;
