export type PromiseCallbackMap = {
  resolve: (value: string | PromiseLike<string>) => void;
  reject: (reason: unknown) => void;
};

export const pendingRequests = new Map<string, PromiseCallbackMap>();
