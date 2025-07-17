import type { WsEvent } from '@aklapper/types';
import { fileURLToPath } from 'url';
import { pendingRequests, type PromiseCallbackMap } from '../data/promise_callback_map/promise_callback_map.js';
import buildWsEvent from './build_go_event.js';
import go_websocketEvent from './go_websocket_event.js';

interface IGo_WsEventManager<RT, DT = RT> {
  setEventName(eventName: string): IGo_WsEventManager<RT, DT>;
  setEventHandlerName(eventName: string): IGo_WsEventManager<RT, DT>;
  setEventData(data: DT): IGo_WsEventManager<RT, DT>;
  setPendingRequestKey(key: string): IGo_WsEventManager<RT, DT>;
  build(): Promise<RT>;
}

export default class Go_WsEventManager<RT, DT = RT> implements IGo_WsEventManager<RT, DT> {
  #ReturnPromise!: Promise<RT>;
  #ResolveRejectObj!: PromiseCallbackMap<RT>;
  #PendingRequests: Map<string, PromiseCallbackMap<RT>>;
  #SocketClient: WebSocket;
  #EventName!: string;
  #EventHandlerName!: string;
  #EventData!: DT;
  #Key!: string;
  constructor(socketClient: WebSocket) {
    this.#PendingRequests = pendingRequests;
    this.#SocketClient = socketClient;
    this.#ResolveRejectObj = { resolve: () => ({}), reject: () => ({}) };
    this.#ReturnPromise = new Promise<RT>((resolve, reject) => {
      this.#ResolveRejectObj = { resolve, reject };
    });
  }
  setEventName(eventName: string): IGo_WsEventManager<RT, DT> {
    this.#EventName = eventName;
    return this;
  }
  setEventHandlerName(eventName: string): IGo_WsEventManager<RT, DT> {
    this.#EventHandlerName = eventName;
    return this;
  }
  setEventData(data: DT): IGo_WsEventManager<RT, DT> {
    this.#EventData = data;
    return this;
  }
  setPendingRequestKey(key: string): IGo_WsEventManager<RT, DT> {
    this.#Key = key;
    return this;
  }
  build(): Promise<RT> {
    if (!this.#EventName || !this.#EventHandlerName || !this.#Key)
      throw new Error(
        `GO_WsEventManager in file ${fileURLToPath(import.meta.url)} is not built correctly. Please check to make sure all necessary fields are present`,
      );
    else {
      this.#PendingRequests.set(this.#Key, this.#ResolveRejectObj);
      const event: WsEvent = buildWsEvent(this.#EventName, this.#EventData);

      this.#SocketClient.onmessage = async (event: MessageEvent) =>
        await go_websocketEvent(event, this.#EventHandlerName, this.#Key);

      this.#SocketClient.send(JSON.stringify(event));

      return this.#ReturnPromise;
    }
  }
}
