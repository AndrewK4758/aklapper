import { USER_ROLE } from '../types/register-user.ts';
import { IRegisterUserClient } from './register-user-client.ts';

export interface IRegisterUser extends IRegisterUserClient {
  id: string;
  createdOn: Date;
  activeGames?: string[];
  friends?: string[];
  role: USER_ROLE;
}
