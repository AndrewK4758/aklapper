import { GameInstanceID } from '@aklapper/types-game';
import { USER_ROLE } from '../types/register-user';
import { IRegisterUserClient } from './register-user-client';

export interface IRegisterUser extends IRegisterUserClient {
  id: string;
  createdOn: Date;
  activeGames?: GameInstanceID[];
  friends?: string[];
  role: USER_ROLE;
}