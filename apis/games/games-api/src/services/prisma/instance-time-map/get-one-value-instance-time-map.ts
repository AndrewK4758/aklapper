import { Minute } from '@aklapper/types-game';
import { prisma } from '@aklapper/prisma';
import { instance_time_map } from '@prisma/client';

const getInstanceTimeMapValue = async (minute: Minute): Promise<instance_time_map | null> => {
  try {
    return await prisma.instance_time_map.findUnique({
      where: { minute_of_day: minute },
    });
  } catch (err) {
    console.error(err);
    return null;
  }
};

export default getInstanceTimeMapValue;
