import type { IPlayer } from '@aklapper/types';
import { activePubClient, activeSubClient } from './redis-client.js';

export type PromiseCallbackMap = {
  resolve: (value: IPlayer | PromiseLike<IPlayer>) => void;
  reject: (reason: unknown) => void;
};

export const pendingRequests = new Map<string, PromiseCallbackMap>();

export async function addPlayerToLobbyGoService(channel: string, data: IPlayer): Promise<IPlayer> {
  return new Promise((resolve, reject) => {
    pendingRequests.set(data.Id, { reject, resolve });

    activePubClient.publish(channel, JSON.stringify(data));

    activeSubClient.subscribe('lobby:player-added', addedPlayer => {
      console.log(addedPlayer);
      const response: IPlayer = JSON.parse(addedPlayer);

      const { Id, InLobby } = response;

      if (Id === data.Id) {
        activeSubClient.unsubscribe('lobby:player-added');

        const { reject, resolve } = pendingRequests.get(Id) as PromiseCallbackMap;

        if (InLobby === true) resolve(data);
        else reject('New player processing error in go lobby service');
      }
    });
  });
}
