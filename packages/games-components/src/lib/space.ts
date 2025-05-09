import { SpaceType, type IAvatar, type ISpace } from '@aklapper/types';
import { Avatar } from './avatar.js';

export class Space implements ISpace {
  Value: string;
  Type: SpaceType;
  Previous!: ISpace;
  Next!: ISpace;
  Special: ISpace | null;
  AvatarsInSpace: IAvatar[];
  Display: string;

  /**
   *
   * @param spaceType SpaceType enum that provides the type of space being created
   * @param spaceValue Non-unique number or string value that will be converted into string
   */
  constructor(spaceType: SpaceType, spaceValue: string | number) {
    this.Type = spaceType;
    this.Value = String(spaceValue) as string;
    this.Special = null;
    this.AvatarsInSpace = [];
    this.Display = String(this.Value);
  }

  get value() {
    return this.Value;
  }

  get type() {
    return this.Type;
  }

  get previous(): ISpace {
    return this.Previous;
  }

  set previous(previous: ISpace) {
    this.Previous = previous;
  }

  get next(): ISpace {
    return this.Next;
  }

  set next(next: ISpace) {
    this.Next = next;
  }

  get special(): ISpace | null {
    return this.Special;
  }

  set special(special: ISpace) {
    this.Special = special;
  }

  get avatarsInSpace() {
    return this.AvatarsInSpace;
  }

  get occupied() {
    return this.avatarsInSpace.length > 0;
  }

  get display() {
    return this.Display;
  }

  set display(displayToken: string) {
    this.Display = displayToken;
  }

  land(avatar: Avatar): void {
    this.ifOccupied();
    if (this.special) {
      this.special.land(avatar);
    } else {
      this.avatarsInSpace.push(avatar);
      avatar.location = this;
    }
  }

  leave(): void {
    if (this.type === SpaceType.START) this.avatarsInSpace.shift();
    else this.avatarsInSpace.pop();
  }

  ifOccupied(): void {
    if (this.occupied && this.type !== SpaceType.START) {
      this.avatarsInSpace[0].move(1);
    }
  }
}

export default Space;
