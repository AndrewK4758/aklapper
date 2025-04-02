import type { IPlayer } from '@aklapper/types';
import { activePubClient, activeSubClient } from './redis-client.js';

export type PromiseCallbackMap = {
  resolve: (value: string | PromiseLike<string>) => void;
  reject: (reason: unknown) => void;
};

export const pendingRequests = new Map<string, PromiseCallbackMap>();

export async function addPlayerToLobbyGoService(channel: string, data: IPlayer): Promise<string> {
  return new Promise((resolve, reject) => {
    pendingRequests.set(data.Id, { reject, resolve });

    activePubClient.publish(channel, JSON.stringify(data));

    activeSubClient.subscribe('lobby:player-added', addedPlayer => {
      const response: Partial<IPlayer> = JSON.parse(addedPlayer);

      if (response) {
        activeSubClient.unsubscribe('lobby:player-added');

        const { resolve } = pendingRequests.get(data.Id) as PromiseCallbackMap;

        if (response.InLobby === true) resolve(addedPlayer);
      } else {
        const { reject } = pendingRequests.get(data.Id) as PromiseCallbackMap;
        reject('New player processing error in go lobby service');
      }
    });
  });
}
