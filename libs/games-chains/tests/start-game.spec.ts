import { ContextBuilder } from '@aklapper/chain';
import { ChutesAndLadders } from '@aklapper/chutes-and-ladders';
import { Game } from '@aklapper/game';
import { InstanceOfGame } from '@aklapper/game-instance';
import { mockReqObj, mockRespObj } from '@aklapper/mocks';
import { Color, Context, GameContextKeys, TurnStatus, type IInstanceOfGame } from '@aklapper/types-game';
import { getCurrentMinute } from '@aklapper/utils';
import { Request, Response } from 'express';
import { sendStartGameStatus } from '../src/lib/commands/action-start-game/send-start-game-status.ts';
import { setAvatarOnStartChutesAndLadders } from '../src/lib/commands/action-start-game/set-on-start-chutes-and-ladders.ts';
import { setPlayerInTurn } from '../src/lib/commands/action-start-game/set-player-in-turn.ts';
import { startGame } from '../src/lib/commands/action-start-game/start-game-start.ts';
import { verifyReadyToPlay } from '../src/lib/commands/action-start-game/verify-ready-to-play.ts';

let ctx: Context<GameContextKeys | string>,
  instanceOfGame: InstanceOfGame,
  game: Game,
  instance: ChutesAndLadders,
  req: Partial<Request>,
  resp: Partial<Response>;

describe('Test start game chain', () => {
  beforeAll(() => {
    ctx = ContextBuilder.build<GameContextKeys | string>();

    instance = new ChutesAndLadders(5, 5);
    game = new Game(instance);
    instanceOfGame = new InstanceOfGame(getCurrentMinute(), 'game-ID', game);

    game.register('player1', 'p-1-id', 'XENOMORPH', Color.RED);
    game.register('player2', 'p-2-id', 'PREDATOR', Color.BLACK);

    req = mockReqObj();
    resp = mockRespObj();

    ctx.put(GameContextKeys.ACTION, 'something-else');
    ctx.put(GameContextKeys.REQUEST, req as Request);
    ctx.put(GameContextKeys.RESPONSE, resp as Response);
    ctx.put(GameContextKeys.GAME, instanceOfGame as IInstanceOfGame);
  });

  afterAll(() => {
    ctx.state.clear();
  });

  it('should fail', () => {
    const commandResult = startGame.execute(ctx);

    expect(commandResult).toEqual(false);
  });

  it('Should verify the context action and add correct next-handler', () => {
    ctx.put(GameContextKeys.ACTION, 'start');
    const commandResult = startGame.execute(ctx);

    expect(commandResult).toEqual(true);
    expect(ctx.getString(GameContextKeys.NEXT)).toEqual('verify-ready-to-play');
  });

  it('should verify the game is ready to play', () => {
    ctx.put(GameContextKeys.NEXT, 'verify-ready-to-play');
    const commandResult = verifyReadyToPlay.execute(ctx);
    expect(commandResult).toEqual(true);

    expect(ctx.get('ready-to-play')).toEqual(true);
    expect(game.playersArray.length).toEqual(2);
  });

  it('should fail and put message on out prop of ctx obj', () => {
    ctx.put(GameContextKeys.NEXT, 'verify-ready-to-play');
    game.playersArray.splice(1);
    const output = { gameStatus: TurnStatus.NOT_READY };

    const commandResult = verifyReadyToPlay.execute(ctx);

    expect(commandResult).toEqual(false);
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
