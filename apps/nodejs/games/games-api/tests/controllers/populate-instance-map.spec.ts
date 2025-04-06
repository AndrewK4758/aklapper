import { mockReqObj, mockRespObj } from '@aklapper/mocks';
import { AllGamesMap } from '@aklapper/models';
import { Request, Response } from 'express';
import populateInstanceMaps from '../../src/controllers/v1/populate_instance_map.js';
import games from '../../src/data/games-list.js';
import { InstanceTimeMap } from '../../src/data/instance-time-map/instance-time-map.js';

let req: Partial<Request>, resp: Partial<Response>;

describe('Test populating game instance map with correct game instance', () => {
  beforeEach(async () => {
    req = mockReqObj();
    resp = mockRespObj();

    req.selectedGameName = 'Chutes & Ladders';
    req.selectedGame = games.find(({ name }) => name === req.selectedGameName);
    req.allGamesMap = new AllGamesMap();
    req.instanceMap = new InstanceTimeMap();
  });

  it('should pass and return status of 201', async () => {
    await populateInstanceMaps(req as Request, resp as Response);

    expect(resp.status).toEqual(201);
    expect((resp as Response).header('current-game')).toBeTruthy();
  });
});
