import Redis from "ioredis"

const globalForRedis = globalThis as unknown as { redis?: Redis | undefined }

function createRedis(): Redis | undefined {
  if (!process.env.REDIS_URL) {
    return undefined
  }
  return new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    enableOfflineQueue: false,
  })
}

export const redis = globalForRedis.redis ?? createRedis()

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis
}
