import { CommandBuilder } from '@aklapper/chain';
import { WINNING_POSITIONS } from '@aklapper/games';
import { type Context, GameContextKeys, IPlayer } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';

export const wonGameCheckTicTacToe = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'won-game') {
    const { game } = deRefContextObject(context);

    const playerTakingTurn = context.get('player-taking-turn') as IPlayer;
    const occupiedSpaces: string[] = [];
    let space = game.instance.instance.startSpace;

    while (space) {
      if (space.occupied) {
        if (space.avatarsInSpace[0].name === playerTakingTurn.avatar.name) {
          occupiedSpaces.push(space.value);
        }
      }
      space = space.next;
    }

    if (occupiedSpaces.length === 5) {
      context.put(GameContextKeys.OUTPUT, { message: 'STALEMATE' });
      return false;
    }

    WINNING_POSITIONS.forEach((v: string[]) => {
      const occupiedSpacesLength = occupiedSpaces.length;
      let start = 0;
      let offset = occupiedSpacesLength > v.length ? occupiedSpacesLength - v.length : 0;
      const result = new Set<string>();
      while (start < occupiedSpacesLength && offset < occupiedSpacesLength) {
        if (v[start] === occupiedSpaces[start]) result.add(v[start]);
        if (offset > 0) {
          if (v[start] === occupiedSpaces[offset]) result.add(v[start]);
        }
        if (result.size === v.length) game.instance.haveWinner = true;
        start++;
        offset++;
      }
    });

    if (game.instance.haveWinner === true) return false;
    else {
      context.put(GameContextKeys.NEXT, 'rotate-player');
      return true;
    }
  } else return false;
});

export default wonGameCheckTicTacToe;
