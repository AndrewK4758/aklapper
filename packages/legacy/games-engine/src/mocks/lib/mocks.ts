import type { Request, Response } from 'express';
import { vitest } from 'vitest';

import { Color, type GamePlayerValidation, type IRegisterFormValues } from '../../types/index.ts';

export const mockReqObj = (): Partial<Request> => {
  const req: Partial<Request> = {
    params: {},
    body: {
      playerName: 'Player Name',
      avatarName: 'XENOMORPH',
      avatarColor: Color.BLACK,
    } as IRegisterFormValues,
    header: vitest.fn<(name: string) => string | undefined>().mockImplementation((name: string) => {
      const headers = new Map<string, string>();
      const __current_game__ = {
        gameInstanceID: 'gameID',
        playerID: 'p-2-id',
      } as GamePlayerValidation;

      headers.set('current-game', JSON.stringify(__current_game__));

      return headers.get(name);
    }) as unknown as Request['header'],
    headers: {
      origin: 'http://localhost:3000',
    },
  };
  return req;
};
const headers = new Map<string, string>();

export const mockRespObj = (): Partial<Response> => {
  const resp: Partial<Response> = {
    setHeader: vitest
      .fn<(name: string, headerValue: string) => Response>()
      .mockImplementation((name: string, headerValue: string) => {
        headers.set(name, headerValue);
        return resp as Response;
      }),
    header: vitest.fn<(name: string) => string | undefined>().mockImplementation(name => {
      return headers.get(name);
    }) as unknown as Response['header'],
    status: vitest.fn<(code: number) => Partial<Response>>().mockImplementation(code => {
      resp.status = code as unknown as Response['status'];
      return resp;
    }) as unknown as Response['status'],
    sendStatus: vitest.fn<(result: number) => Partial<Response>>().mockImplementation(result => {
      resp.status = result as unknown as Response['status'];
      return resp;
    }) as unknown as Response['sendStatus'],
    json: vitest.fn<(result: unknown) => Partial<Response>>().mockImplementation(result => {
      resp.json = result as unknown as Response['json'];
      return resp;
    }) as unknown as Response['json'],
  };
  return resp;
};
