import type { IRegisterUser } from '@aklapper/types-api';
import { users } from '@prisma/client';
declare const addUser: ({ id, firstName, lastName, email, createdOn, password, playerName, thumbnail, role }: IRegisterUser) => Promise<users>;
export default addUser;
//# sourceMappingURL=add-user.d.ts.map