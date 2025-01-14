import { generatePassword } from '@aklapper/password';
import { prisma } from '@aklapper/prisma';
import type { IRegisterUser } from '@aklapper/types-api';
import type { users } from '@prisma/client';
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

const addUser = async ({
  id,
  firstName,
  lastName,
  email,
  createdOn,
  password,
  playerName,
  thumbnail,
  role
}: IRegisterUser): Promise<users> => {
  try {
    const hashPassword = await generatePassword(password);

    return await prisma.users.create({
      data: {
        id: id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        created_on: createdOn,
        password: hashPassword,
        player_name: playerName,
        thumbnail: thumbnail as string,
        role: role
      }
    });
  } catch (error) {
    const err = error as PrismaClientKnownRequestError;
    if (err) {
      console.error(err);
      // console.error((err.meta as Record<string, string>).target[0] === 'email');
      throw new Error('Email is already registered');
    } else {
      throw new Error((error as Error).message);
    }
  }
};

export default addUser;
