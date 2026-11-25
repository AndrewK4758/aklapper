import { SpaceType } from '@aklapper/legacy-games/types';

import { Board } from '../../src/components/lib/board.ts';
import { Space } from '../../src/components/lib/space.ts';

let space: Space;

describe('Test connection of spaces within the boardSetup method', () => {
  beforeEach(() => {
    space = new Board(100, () => new Space(SpaceType.NORMAL, 'space')).boardSetup();
  });

  test('traversing entire list', () => {
    while (space) {
      expect(space).not.toBeNull();
      expect(space).toBeInstanceOf(Space);
      space = space.next;
    }
  });

  test('traversing entire list backwards', () => {
    while (space.next) {
      space = space.next;
      expect(space.previous).not.toBeNull();
      expect(space.previous).toBeInstanceOf(Space);
    }
  });
});
