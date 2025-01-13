import addUser from '../../src/services/prisma/users/add-user';
import { USER_ROLE, type IRegisterUser } from '@aklapper/types-api';
import ShortUniqueId from 'short-unique-id';

process.env['NODE_ENV'] = 'development'

describe('Test add user service', () => {
  it('should pass and return the details of the newly added user', async () => {
    const id = new ShortUniqueId().rnd();
    const userInfo: IRegisterUser = {
      id: id,
      firstName: 'first',
      lastName: 'last',
      email: `${id}@email.email`,
      createdOn: new Date(),
      password: 'password',
      playerName: 'player-name',
      role: USER_ROLE.USER,
    };

    console.log(process.env['NODE_ENV'])
    const newUser = await addUser(userInfo);

    expect(newUser).toBeTruthy();
    expect(newUser.password).not.toEqual(userInfo.password);
    expect(newUser.first_name).toEqual(userInfo.firstName);
  });
});
