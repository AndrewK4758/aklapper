// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WsResponse<T = any> = {
  event: string;
  response: T;
  status: 'success' | 'error';
};

export interface WsEvent {
  event: string;
  data: WsResponse;
}
