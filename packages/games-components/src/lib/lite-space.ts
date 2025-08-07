import type { ILiteSpace } from '@aklapper/types';

export class LiteSpace implements ILiteSpace {
  display: string;
  occupied: boolean;
  defaultDisplayName: string;

  constructor(display: string, defaultDisplayName: string) {
    this.display = display;
    this.defaultDisplayName = defaultDisplayName;
    this.occupied = display.endsWith('.webp');
  }

  static MakeSpace = (display: string, defaultDisplayName: string) => new LiteSpace(display, defaultDisplayName);
}
export default LiteSpace;
