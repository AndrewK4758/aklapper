import { GameInstanceID, GamesInMinute, IInstanceTimeMap, Minute } from '@aklapper/types-game';
import { getCurrentMinute } from '@aklapper/utils';

export class InstanceTimeMap implements IInstanceTimeMap {
  Map: Map<Minute, GamesInMinute>;
  constructor() {
    this.Map = new Map<Minute, GamesInMinute>();
    for (let i = 0; i <= 24 * 60; i++) {
      this.Map.set(i, []);
    }
    this.Map.set(2000, []);
  }

  addGameInstance(minute: Minute, gameInstanceID: GameInstanceID): void {
    this.Map.get(minute)?.push(gameInstanceID);
  }
}

export const reaper = (instanceTimeMap: IInstanceTimeMap) => {
  const dayMinusOneMinuteInMilli = 24 * 60 * 59 * 1000;
  setTimeout(() => {
    setInterval(async () => {
      const currentMinute = getCurrentMinute();
      const minuteAhead = currentMinute === 1440 ? 0 : currentMinute + 1;

      if (minuteAhead === 0) {
        instanceTimeMap.Map.set(2000, []);
      }
      const dayOldGames = instanceTimeMap.Map.get(minuteAhead);

      (instanceTimeMap.Map.get(2000) as GamesInMinute).push(...(dayOldGames as GamesInMinute));
      instanceTimeMap.Map.set(minuteAhead, []);
    }, 60 * 1000);
  }, dayMinusOneMinuteInMilli);
};
