import { ILiteSpace } from '@aklapper/types-game';

export class LiteSpace implements ILiteSpace {
  display: string;

  constructor(display: string) {
    this.display = display;
  }

  static MakeSpace = (display: string) => new LiteSpace(display);
}
