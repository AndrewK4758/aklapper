import type { EmailAddress } from '@aklapper/types-api';
declare const deleteUser: (email: EmailAddress) => Promise<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    created_on: Date;
    password: string;
    player_name: string;
    active_games: string[];
    friends: string[];
    role: string;
    thumbnail: string | null;
} | null>;
export default deleteUser;
//# sourceMappingURL=delete-user.d.ts.map