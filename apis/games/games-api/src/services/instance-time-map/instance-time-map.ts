import { GameInstanceID, GamesInMinute, IInstanceTimeMap, Minute } from '@aklapper/types-game';
import { getCurrentMinute } from '@aklapper/utils';
import type { instance_time_map } from '@prisma/client';
import deleteValuesInstanceTimeMap from '../prisma/instance-time-map/delete-values-instance-time-map';
import getInstanceTimeMapValue from '../prisma/instance-time-map/get-one-value-instance-time-map';
import updateInstanceTimeMap from '../prisma/instance-time-map/update-instance-time-map';

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
        await deleteValuesInstanceTimeMap();
      }
      const dayOldGames = instanceTimeMap.Map.get(minuteAhead);
      const dayOldGamesDB = await getInstanceTimeMapValue(minuteAhead);
      (dayOldGamesDB as instance_time_map).games_in_minute.forEach(
        async (game: string) => await updateInstanceTimeMap(2000, game)
      );
      (instanceTimeMap.Map.get(2000) as GamesInMinute).push(...(dayOldGames as GamesInMinute));
      await updateInstanceTimeMap(minuteAhead, '');
      instanceTimeMap.Map.set(minuteAhead, []);
    }, 60 * 1000);
  }, dayMinusOneMinuteInMilli);
};
