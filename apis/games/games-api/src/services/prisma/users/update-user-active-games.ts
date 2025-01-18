import { prismaClientGames } from '@aklapper/prisma';

const updateUserActiveGames = async (userID: string, gameID: string) => {
  try {
    await prismaClientGames.users.update({
      where: {
        id: userID
      },
      data: {
        active_games: {
          push: gameID
        }
      }
    });
  } catch (err) {
    console.error(err);
  }
};

export default updateUserActiveGames;
