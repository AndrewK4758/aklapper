import { ContextBuilder } from '@aklapper/chain';
import { Game } from '@aklapper/game';
import { ChutesAndLadders } from '@aklapper/games';
import { Player } from '@aklapper/games-components';
import { mockReqObj, mockRespObj } from '@aklapper/mocks';
import { InstanceOfGame } from '@aklapper/models';
import {
  Color,
  Context,
  GameContextKeys,
  SpaceType,
  TurnStatus,
  type IAvatar,
} from '@aklapper/types';
import { getCurrentMinute } from '@aklapper/utils';
import { Request, Response } from 'express';
import { moveAvatar } from '../src/lib/commands/action-take-turn/move-avatar.js';
import { rollDice } from '../src/lib/commands/action-take-turn/roll-dice.js';
import { rotatePlayer } from '../src/lib/commands/action-take-turn/rotate-player.js';
import { takeTurnStart } from '../src/lib/commands/action-take-turn/take-turn-start.js';
import { verifyPlayerTakingTurn } from '../src/lib/commands/action-take-turn/verify-player-taking-turn.js';
import { wonGameCheckChutesAndLadders } from '../src/lib/commands/action-take-turn/won-game-chutes-and-ladders.js';

interface ICtxOutput {
  turnStatus: TurnStatus;
}

let ctx: Context<GameContextKeys | string>,
  instanceOfGame: InstanceOfGame,
  game: Game,
  output: ICtxOutput,
  turnStatus: TurnStatus,
  instance: ChutesAndLadders,
  avatar1: IAvatar,
  avatar2: IAvatar,
  req: Partial<Request>,
  resp: Partial<Response>;

describe('should execute all steps of taking turn', () => {
  beforeAll(() => {
    ctx = ContextBuilder.build();
    instance = new ChutesAndLadders(5, 5);
    game = new Game(instance);
    instanceOfGame = new InstanceOfGame(getCurrentMinute(), 'game-ID', game);

    instanceOfGame.instance.register(
      'avatar1',
      'p-1-id',
      'XENOMORPH',
      Color.RED,
    );
    instanceOfGame.instance.register(
      'avatar2',
      'p-2-id',
      'PREDATOR',
      Color.BLACK,
    );

    avatar1 = instanceOfGame.instance.playersArray[0].avatar;
    avatar2 = instanceOfGame.instance.playersArray[1].avatar;

    instanceOfGame.instance.instance.startSpace.land(avatar1);
    instanceOfGame.instance.instance.startSpace.land(avatar2);

    instanceOfGame.instance.playerInTurn =
      instanceOfGame.instance.playersArray.find(
        ({ id }) => id === 'p-2-id',
      ) as Player;

    turnStatus = TurnStatus.NOT_READY;
    output = { turnStatus: turnStatus };

    req = mockReqObj();
    resp = mockRespObj();

    if (req.params) req.params['id'] = 'Chutes-&-Ladders';

    ctx.put(GameContextKeys.ACTION, 'take-turn');
    ctx.put(GameContextKeys.REQUEST, req as Request);
    ctx.put(GameContextKeys.RESPONSE, resp as Response);
    ctx.put(GameContextKeys.GAME, instanceOfGame);
  });

  it('should fail because game is in NOT_READY state when receiving a turn ', () => {
    const commandResult = takeTurnStart.execute(ctx);

    expect(commandResult).toBeFalsy();
    expect(ctx.get(GameContextKeys.OUTPUT)).toEqual(output);
  });

  it('should fail because game is in GAME_WON state when receiving a turn', () => {
    instanceOfGame.instance.readyToPlay = true;
    instanceOfGame.instance.haveWinner = true;

    output = { turnStatus: TurnStatus.GAME_WON };
    const commandResult = takeTurnStart.execute(ctx);

    expect(commandResult).toBeFalsy();
    expect(ctx.get(GameContextKeys.OUTPUT)).toEqual(output);
  });

  it('should pass to next command', () => {
    instanceOfGame.instance.readyToPlay = true;
    instanceOfGame.instance.haveWinner = false;

    const commandResult = takeTurnStart.execute(ctx);

    expect(commandResult).toBeTruthy();
    expect(instanceOfGame.lastActive).toEqual(getCurrentMinute());
    expect(ctx.getString(GameContextKeys.NEXT)).toEqual('verify-player');
  });

  it('should fail for incorrect ACTION on ctx obj', () => {
    ctx.put(GameContextKeys.ACTION, 'register');
    const commandResult = takeTurnStart.execute(ctx);

    expect(commandResult).toBeFalsy();
  });

  it('should pass to roll-dice', () => {
    ctx.put(GameContextKeys.NEXT, 'verify-player');

    const commandResult = verifyPlayerTakingTurn.execute(ctx);

    expect(commandResult).toBeTruthy();
    expect(ctx.get('player-taking-turn')).toEqual(
      instanceOfGame.instance.playerInTurn as Player,
    );
  });

  it('should fail due to incorrect player taking turn', () => {
    ctx.put(GameContextKeys.NEXT, 'verify-player');

    instanceOfGame.instance.playerInTurn = new Player('player', 'id');
    output = { turnStatus: TurnStatus.INVALID };
    const commandResult = verifyPlayerTakingTurn.execute(ctx);
    expect(commandResult).toBeFalsy();
    expect(ctx.get(GameContextKeys.OUTPUT)).toEqual(output);

    instanceOfGame.instance.playerInTurn =
      instanceOfGame.instance.playersArray[0];
  });

  it('should fail for incorrect next-handler', () => {
    ctx.put(GameContextKeys.NEXT, 'something-else');

    const commandResult = verifyPlayerTakingTurn.execute(ctx);

    expect(commandResult).toBeFalsy();
  });

  it('should pass and add a moveDist prop to ctx obj. moveDist value is between 1 and number of sides of Die in Game', () => {
    ctx.put(GameContextKeys.NEXT, 'roll-dice');
    const commandResult = rollDice.execute(ctx);

    expect(commandResult).toBeTruthy();
    expect(ctx.get('move-dist')).toBeGreaterThanOrEqual(1);
    expect(ctx.get('move-dist')).toBeLessThanOrEqual(
      (instanceOfGame.instance.instance as ChutesAndLadders).DIE.sides,
    );
  });
  it('should fail', () => {
    ctx.put(GameContextKeys.NEXT, 'something-else');

    const commandResult = rollDice.execute(ctx);

    expect(commandResult).toBeFalsy();
  });

  it('should pass with out prop of ctx obj being a valid turn status and update the location of player in turn avatar', () => {
    ctx.put(GameContextKeys.NEXT, 'move-avatar');
    output = { turnStatus: TurnStatus.VALID };

    const moveDist = (
      instanceOfGame.instance.instance as ChutesAndLadders
    ).DIE.roll() as number;

    ctx.put('player-taking-turn', instanceOfGame.instance.playerInTurn);
    ctx.put('move-dist', moveDist);

    const commandResult = moveAvatar.execute(ctx);

    expect(commandResult).toBeTruthy();
    expect(
      (ctx.get('player-taking-turn') as Player).avatar.location.type,
    ).toEqual(SpaceType.NORMAL);
    expect(ctx.get(GameContextKeys.OUTPUT)).toEqual(output);
  });

  it('should fail', () => {
    ctx.put(GameContextKeys.NEXT, 'something-else');

    const commandResult = moveAvatar.execute(ctx);

    expect(commandResult).toBeFalsy();
  });

  it('should pass and send ctx to next command in chain', () => {
    ctx.put(GameContextKeys.NEXT, 'won-game');

    const playerTakingTurn = instanceOfGame.instance.playersArray[0] as Player;
    playerTakingTurn.avatar.location =
      instanceOfGame.instance.instance.startSpace;

    ctx.put('player-taking-turn', playerTakingTurn);
    const commandResult = wonGameCheckChutesAndLadders.execute(ctx);

    expect(commandResult).toBeTruthy();
    expect(ctx.getString(GameContextKeys.NEXT)).toEqual('rotate-player');
  });

  it('should fail and flip haveWinner flag in game instance to true', () => {
    ctx.put(GameContextKeys.NEXT, 'won-game');

    const playerTakingTurn = instanceOfGame.instance.playerInTurn as Player;
    instanceOfGame.instance.instance.startSpace.land(playerTakingTurn.avatar);

    while (playerTakingTurn.avatar.location.next) {
      playerTakingTurn.avatar.location = playerTakingTurn.avatar.location.next;
    }

    ctx.put('player-taking-turn', playerTakingTurn);

    const commandResult = wonGameCheckChutesAndLadders.execute(ctx);

    expect(commandResult).toBeFalsy();
    expect(instanceOfGame.instance.haveWinner).toBeTruthy();
  });

  it('should pass and rotate player in turn within the active players array in game instance', () => {
    ctx.put(GameContextKeys.NEXT, 'rotate-player');

    const commandResult = rotatePlayer.execute(ctx);

    expect(commandResult).toBeTruthy();
    expect(instanceOfGame.instance.playerInTurn).toEqual(
      instanceOfGame.instance.playersArray[1],
    );
  });

  it('should fail', () => {
    ctx.put(GameContextKeys.NEXT, 'something-else');

    const commandResult = rotatePlayer.execute(ctx);

    expect(commandResult).toBeFalsy();
  });
});
