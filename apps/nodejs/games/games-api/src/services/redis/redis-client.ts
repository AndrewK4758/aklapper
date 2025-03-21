import redis, { type RedisClientType } from 'redis';

const redisPubClient: RedisClientType = redis.createClient({
  socket: {
    host: 'localhost',
    port: 6379
  }
});

export const activePubClient: RedisClientType = await redisPubClient.connect();

const redisSubClient: RedisClientType = redis.createClient({
  socket: {
    host: 'localhost',
    port: 6379
  }
});

export const activeSubClient: RedisClientType = await redisSubClient.connect();

activeSubClient.subscribe('error', err => {
  console.error(err);
  throw err;
});
