import type { IClientPlayerInfo } from '@aklapper/types';

export type RegisterPlayerValue = {
  name: string;
};

export interface IActivePlayerContext extends IClientPlayerInfo {
  activeGameID: string | null;
}
