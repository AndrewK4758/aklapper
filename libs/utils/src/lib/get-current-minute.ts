import { Minute } from '@aklapper/types-game';

export const getCurrentMinute = (): Minute => {
  const currentTime = new Date();
  return currentTime.getHours() * 60 + currentTime.getMinutes();
};
