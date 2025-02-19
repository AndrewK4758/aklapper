import { ILiteSpace } from '@aklapper/types';

export class LiteSpace implements ILiteSpace {
  display: string;

  constructor(display: string) {
    this.display = display;
  }

  static MakeSpace = (display: string) => new LiteSpace(display);
}
export default LiteSpace;
