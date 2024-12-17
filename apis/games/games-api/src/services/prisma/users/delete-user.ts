import { prisma } from '@aklapper/prisma';
import type { EmailAddress } from '@aklapper/types-api';

const deleteUser = async (email: EmailAddress) => {
  try {
    return await prisma.users.delete({ where: { email: email } });
  } catch (error) {
    console.error(error);
    return null;
  }
};

export default deleteUser;
