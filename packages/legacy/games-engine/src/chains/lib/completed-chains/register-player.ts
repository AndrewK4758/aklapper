import { ChainBuilder } from '../../../chain/index.ts';
import createPlayerID from '../commands/action-register-player/create-player-id.ts';
import filterSelectedAvatar from '../commands/action-register-player/filter-selected-avatar.ts';
import playerCreated from '../commands/action-register-player/player-created.ts';
import registerOnGameInstance from '../commands/action-register-player/register-on-game-instance.ts';
import registerPlayerStart from '../commands/action-register-player/register-player-start.ts';

export const registerChain = ChainBuilder.build(
  [
    registerPlayerStart,
    createPlayerID,
    registerOnGameInstance,
    filterSelectedAvatar,
    playerCreated,
  ],
  false,
);
