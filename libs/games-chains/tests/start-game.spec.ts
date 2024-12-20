import { ContextBuilder } from '@aklapper/chain';
import { ChutesAndLadders } from '@aklapper/chutes-and-ladders';
import { Game } from '@aklapper/game';
import { InstanceOfGame } from '@aklapper/game-instance';
import { getCurrentMinute } from '@aklapper/utils';
import { Color, Context, GameContextKeys, TurnStatus } from '@aklapper/types-game';
import { mockReqObj, mockRespObj } from '@aklapper/mocks';
import { Request, Response } from 'express';
import { sendStartGameStatus } from '../src/lib/commands/action-start-game/send-start-game-status';
import { setAvatarOnStartChutesAndLadders } from '../src/lib/commands/action-start-game/set-on-start-chutes-and-ladders';
import { setPlayerInTurn } from '../src/lib/commands/action-start-game/set-player-in-turn';
import { startGame } from '../src/lib/commands/action-start-game/start-game-start';
import { verifyReadyToPlay } from '../src/lib/commands/action-start-game/verify-ready-to-play';

let ctx: Context,
  instanceOfGame: InstanceOfGame,
  game: Game,
  instance: ChutesAndLadders,
  req: Partial<Request>,
  resp: Partial<Response>;

describe('execute all steps of starting a game', () => {
  beforeAll(() => {
    ctx = ContextBuilder.build();

    instance = new ChutesAndLadders(5, 5);
    game = new Game(instance);
    instanceOfGame = new InstanceOfGame(getCurrentMinute(), 'game-ID', game);

    game.register('player1', 'p-1-id', 'XENOMORPH', Color.RED);
    game.register('player2', 'p-2-id', 'PREDATOR', Color.BLACK);

    req = mockReqObj();
    resp = mockRespObj();

    ctx.put(GameContextKeys.ACTION, 'start');
    ctx.put(GameContextKeys.REQUEST, req);
    ctx.put(GameContextKeys.RESPONSE, resp);
    ctx.put(GameContextKeys.GAME, instanceOfGame);
  });

  afterAll(() => {
    ctx.state.clear();
  });

  it('should verify the context action is start and send to next-handler', () => {
    const commandResult = startGame.execute(ctx);

    expect(commandResult).toBeTruthy();
    expect(ctx.getString(GameContextKeys.NEXT)).toEqual('verify-ready-to-play');
  });

  it('should fail', () => {
    ctx.put(GameContextKeys.ACTION, 'something-else');

    const commandResult = startGame.execute(ctx);

    expect(commandResult).toBeFalsy();
  });

  it('should verify the game is ready to play', () => {
    ctx.put(GameContextKeys.NEXT, 'verify-ready-to-play');
    const commandResult = verifyReadyToPlay.execute(ctx);

    expect(commandResult).toBeTruthy();
    expect(ctx.get('ready-to-play')).toBeTruthy();
    expect(game.playersArray.length).toEqual(2);
  });

  it('should fail and put message on out prop of ctx obj', () => {
    ctx.put(GameContextKeys.NEXT, 'verify-ready-to-play');
    game.playersArray.splice(1);
    const output = { gameStatus: TurnStatus.NOT_READY };

    const commandResult = verifyReadyToPlay.execute(ctx);

    expect(commandResult).toBeFalsy();
    expect(ctx.get(GameContextKeys.OUTPUT)).toEqual(output);
  });

  it('should pass and place avatars on startspace and set order prop on player', () => {
    ctx.put(GameContextKeys.NEXT, 'set-avatars-on-start');
    ctx.put('ready-to-play', true);

    const commandResult = setAvatarOnStartChutesAndLadders.execute(ctx);

    expect(commandResult).toBeTruthy();

    game.playersArray.forEach(p => {
      expect(p.avatar.location.type).toEqual(game.instance.startSpace.type);
      expect(p.order).toBeTruthy();
    });
  });
  it('should fail', () => {
    ctx.put(GameContextKeys.NEXT, 'set-avatars-on-start');
    ctx.put('ready-to-play', false);
    const commandResult = setAvatarOnStartChutesAndLadders.execute(ctx);
    expect(commandResult).toBeFalsy();
  });

  it('should pass and set the player in turn to the first player in the players array', () => {
    ctx.put(GameContextKeys.NEXT, 'set-player-in-turn');
    const commandResult = setPlayerInTurn.execute(ctx);
    expect(commandResult).toBeTruthy();
    expect(game.playerInTurn).toEqual(game.playersArray[0]);
    expect(game.playerInTurn).not.toEqual(game.playersArray[1]);
  });

  it('should pass and add a message to the out prop of ctx obj', () => {
    ctx.put(GameContextKeys.NEXT, 'send-start-game-status');
    const output = { message: 'Game Started' };

    const commandResult = sendStartGameStatus.execute(ctx);
    expect(commandResult).toBeTruthy();
    expect((ctx.get(GameContextKeys.OUTPUT) as { message: string }).message).toEqual(output.message);
  });
});
