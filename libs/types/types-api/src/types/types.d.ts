import { IAllGamesMap } from '@aklapper/types-game';
import { IInstanceTimeMap } from '@aklapper/types-game';
import { Chain } from '@aklapper/chain';
import { GameNameString, PlayerID } from '@aklapper/types-game';
import { IBuiltGame } from '@aklapper/types-game';
import { IInstanceOfGame } from '@aklapper/types-game';
import { LoginData } from '@aklapper/types-game';

declare global {
  namespace Express {
    interface Request {
      allGamesMap: IAllGamesMap;
      instanceMap: IInstanceTimeMap;
      gameSpecificChain: Chain | null;
      selectedGameName: GameNameString;
      selectedGame: IBuiltGame | undefined;
      loginData: LoginData;
      activeGameInstance: IInstanceOfGame | null;
      playerID: PlayerID;
    }
  }
}
