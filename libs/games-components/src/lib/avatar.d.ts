import { Color, IAvatar } from '@aklapper/types-game';
import { Space } from './space.ts';
export declare class Avatar implements IAvatar {
    Name: string;
    Color: Color;
    Location: Space;
    constructor(name: string, color: Color);
    get name(): string;
    get color(): Color;
    get location(): Space;
    set location(location: Space);
    _moveForward(numberOfSpaces: number): Space | null;
    _moveBackward(numberOfSpaces: number): Space | null;
    move(numberOfSpaces: number): void;
}
//# sourceMappingURL=avatar.d.ts.map