import type { IClientPlayerInfo } from '@aklapper/types';
import redis, { type RedisClientType } from 'redis';

const redisClient: RedisClientType = redis.createClient({
  socket: {
    host: 'localhost',
    port: 6379
  }
});

const activeClient: RedisClientType = await redisClient.connect();

await activeClient.publish('new-player', JSON.stringify({ name: 'name', id: 'ididid' } as IClientPlayerInfo));

export default activeClient;
