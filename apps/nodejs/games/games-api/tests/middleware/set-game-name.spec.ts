import { mockReqObj } from '@aklapper/mocks';
import type { Request } from 'express';
import useSetSelectedGameName from '../../src/middleware/set-selected-game-name.js';

let req: Partial<Request>;

describe('Test use selected game name middleware', () => {
  beforeAll(() => {
    req = mockReqObj() as Partial<Request>;

    (req as Request).params['id'] = 'Game-Name-To-Test';
  });

  it('Should pass and remove the dashes in the id property', () => {
    req.selectedGameName = useSetSelectedGameName(req as Request);

    expect(req.selectedGameName).toEqual('Game Name To Test');
  });
});
