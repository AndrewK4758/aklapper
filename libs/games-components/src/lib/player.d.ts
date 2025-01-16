import { IPlayer } from '@aklapper/types-game';
import { Avatar } from './avatar.ts';
export declare class Player implements IPlayer {
    Id: string;
    Name: string;
    Order: number;
    Avatar: Avatar;
    constructor(name: string, id: string);
    get id(): string;
    get name(): string;
    get order(): number;
    set order(order: number);
    get avatar(): Avatar;
    set avatar(avatar: Avatar);
}
//# sourceMappingURL=player.d.ts.map