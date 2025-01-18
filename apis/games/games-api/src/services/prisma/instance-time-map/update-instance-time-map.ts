import { GameInstanceID, Minute } from '@aklapper/types-game';
import { prismaClientGames } from '@aklapper/prisma';

const updateInstanceTimeMap = async (minute: Minute, gameID: GameInstanceID): Promise<void> => {
  try {
    await prismaClientGames.instance_time_map.upsert({
      where: {
        minute_of_day: minute
      },
      create: {
        minute_of_day: minute,
        games_in_minute: [gameID]
      },
      update: {
        minute_of_day: minute,
        games_in_minute: { push: gameID }
      }
    });
  } catch (err) {
    console.error(err);
  }
};

export default updateInstanceTimeMap;
