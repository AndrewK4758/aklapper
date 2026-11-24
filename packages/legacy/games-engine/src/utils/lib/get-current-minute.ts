import type { Minute } from '../../types/index.ts';

export const getCurrentMinute = (): Minute => {
  const currentTime = new Date();
  return currentTime.getHours() * 60 + currentTime.getMinutes();
};
