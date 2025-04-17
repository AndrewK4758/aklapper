export type WsResponse = {
  response: unknown;
  status: 'success' | 'error';
};

export interface WsEvent {
  event: string;
  data: unknown | WsResponse;
}
