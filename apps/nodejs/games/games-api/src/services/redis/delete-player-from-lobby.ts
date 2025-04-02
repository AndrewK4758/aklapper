import { activePubClient } from './redis-client.js';

export async function deletePlayerFromLobby(channel: string, playerID: string) {
  return new Promise((resolve, _reject) => {
    activePubClient.publish(channel, playerID);

    resolve('player deleted');
  });
}
