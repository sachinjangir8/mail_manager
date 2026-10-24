import Redis, { RedisOptions } from "ioredis";
import { env } from "../config/env";
import { logger } from "../utils/logger";

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = "READONLY";
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
};

/**
 * Creates a new Redis instance with standard error logging and config
 */
export function createRedisClient(customOptions?: Partial<RedisOptions>): Redis {
  const client = new Redis(env.REDIS_URL, {
    ...redisOptions,
    ...customOptions,
  });

  client.on("error", (err) => {
    logger.warn({ err: err.message }, "Redis connection event/warning");
  });

  client.on("connect", () => {
    logger.info("Connected to Redis successfully");
  });

  return client;
}

// Dedicated shared Redis instances
export const redisConnection = createRedisClient();
