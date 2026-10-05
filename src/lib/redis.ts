import Redis from "ioredis"

import { logger } from "@/lib/logger"

const globalForRedis = globalThis as unknown as { redis?: Redis | undefined }

function createRedis(): Redis | undefined {
  if (!process.env.REDIS_URL) {
    return undefined
  }
  const client = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    enableOfflineQueue: false,
  })
  // ioredis avisa "missing 'error' handler" se ninguém escuta o evento
  client.on("error", (err: Error) => {
    logger.warn({ err }, "[redis] erro no cliente (fail-fast, sem retry)")
  })
  return client
}

export const redis = globalForRedis.redis ?? createRedis()

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis
}
