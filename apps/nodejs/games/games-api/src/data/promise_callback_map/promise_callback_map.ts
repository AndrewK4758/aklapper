import type { WsResponse } from '@aklapper/types';

export type PromiseCallbackMap = {
  resolve: (value: WsResponse | PromiseLike<WsResponse>) => void;
  reject: (reason: unknown) => void;
};

export const pendingRequests = new Map<string, PromiseCallbackMap>();
