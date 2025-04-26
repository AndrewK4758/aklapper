/* eslint-disable @typescript-eslint/no-explicit-any */
export type PromiseCallbackMap<T> = {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason: T) => void;
};

export const pendingRequests = new Map<string, PromiseCallbackMap<any>>();
