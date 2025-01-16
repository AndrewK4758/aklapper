import { SpaceType, ISpace, IAvatar } from '@aklapper/types-game';
import { Avatar } from './avatar.ts';
export declare class Space implements ISpace {
    Value: string;
    Type: SpaceType;
    Previous: ISpace;
    Next: ISpace;
    Special: ISpace | null;
    AvatarsInSpace: IAvatar[];
    Display: string;
    constructor(spaceType: SpaceType, spaceValue: string | number);
    get value(): string;
    get type(): SpaceType;
    get previous(): ISpace;
    set previous(previous: ISpace);
    get next(): ISpace;
    set next(next: ISpace);
    get special(): ISpace | null;
    set special(special: ISpace);
    get avatarsInSpace(): IAvatar[];
    get occupied(): boolean;
    get display(): string;
    set display(displayToken: string);
    land(avatar: Avatar): void;
    leave(): void;
    ifOccupied(): void;
}
//# sourceMappingURL=space.d.ts.map