import type { Prisma, users } from '@prisma/client';
import { Request, Response } from 'express';
import notRegisteredUserError from '../errors/not-registered-user-error.ts';
import findUser from '../services/prisma/users/find-user.ts';
import verifyUser from '../services/prisma/users/verify-user.ts';
import type { DefaultArgs } from '@prisma/client/runtime/library';

const loginUser = async (req: Request, resp: Response) => {
  try {
    const { email, password } = req.body;
    const query: Prisma.usersFindUniqueArgs<DefaultArgs> = {
      where: {
        email: email
      }
    };
    const user = await findUser(query);

    if (!user) {
      console.log('no user');
      resp.status(401).json(notRegisteredUserError());
    }
    const verifiedUser = await verifyUser(password, (user as users).password);

    if (!verifiedUser) {
      resp.status(401).json({ errorMessage: 'Incorrect password. Please try again' });
    } else {
      const activeUser = {
        id: (user as users).id,
        playerName: (user as users).player_name,
        friends: (user as users).friends,
        activeGames: (user as users).active_games,
        thumbnail: (user as users).thumbnail
      };

      resp.status(200).json(activeUser);
    }
  } catch (err) {
    console.error(err);
    resp.status(500).json({ errorMessage: 'Login failed' });
  }
};

export default loginUser;
