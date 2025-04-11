import { Color, type GamePlayerValidation, type IRegisterFormValues } from '@aklapper/types';
import type { Request, Response } from 'express';
import { vitest } from 'vitest';

export const mockReqObj = (): Partial<Request> => {
  const req: Partial<Request> = {
    params: {},
    body: {
      playerName: 'Player Name',
      avatarName: 'XENOMORPH',
      avatarColor: Color.BLACK,
    } as IRegisterFormValues,
    header: vitest.fn().mockImplementation((name: string) => {
      const headers = new Map<string, string>();
      const __current_game__ = {
        gameInstanceID: 'gameID',
        playerID: 'p-2-id',
      } as GamePlayerValidation;

      headers.set('current-game', JSON.stringify(__current_game__));

      return headers.get(name);
    }),
    headers: {
      origin: 'http://localhost:3000',
    },
  };
  return req;
};
const headers = new Map<string, string>();

export const mockRespObj = (): Partial<Response> => {
  const resp: Partial<Response> = {
    setHeader: vitest.fn().mockImplementation((name: string, headerValue: string) => {
      headers.set(name, headerValue);
    }),
    header: vitest.fn().mockImplementation(name => {
      return headers.get(name);
    }),
    status: vitest.fn().mockImplementation(code => {
      resp.status = code;
      return resp;
    }),
    sendStatus: vitest.fn().mockImplementation(result => (resp.status = result)),
    json: vitest.fn().mockImplementation(result => {
      resp.json = result;
      return resp;
    }),
  };
  return resp;
};
