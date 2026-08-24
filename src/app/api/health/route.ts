import net from "node:net"
import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { APP_VERSION } from "@/lib/version"

export const dynamic = "force-dynamic"

const DB_CHECK_TIMEOUT_MS = 5_000
const REDIS_CHECK_TIMEOUT_MS = 3_000

type DatabaseStatus = { status: "ok" } | { status: "error" }

type RedisStatus =
  { status: "ok" } | { status: "error" } | { status: "not-configured" }

function timeBox<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer)
    }
  })
}

async function checkDatabase(): Promise<DatabaseStatus> {
  try {
    await timeBox(
      prisma.$queryRaw`SELECT 1`,
      DB_CHECK_TIMEOUT_MS,
      "database check timed out",
    )
    return { status: "ok" }
  } catch (error) {
    logger.error({ err: error }, "[health] database check failed")
    return { status: "error" }
  }
}

async function probeRedisTcp(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl)
  await new Promise<void>((resolve, reject) => {
    const socket = net.connect({
      host: url.hostname,
      port: Number(url.port) || 6379,
    })
    const fail = (error: Error) => {
      socket.destroy()
      reject(error)
    }
    socket.on("error", fail)
    socket.setTimeout(REDIS_CHECK_TIMEOUT_MS, () =>
      fail(new Error("redis check timed out")),
    )
    socket.on("connect", () => {
      socket.write("*1\r\n$4\r\nPING\r\n")
    })
    socket.on("data", (chunk) => {
      if (chunk.toString().startsWith("+PONG")) {
        socket.destroy()
        resolve()
      } else {
        fail(new Error("unexpected redis response"))
      }
    })
  })
}

async function checkRedis(): Promise<RedisStatus> {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    return { status: "not-configured" }
  }
  try {
    await timeBox(
      probeRedisTcp(redisUrl),
      REDIS_CHECK_TIMEOUT_MS,
      "redis check timed out",
    )
    return { status: "ok" }
  } catch (error) {
    logger.error({ err: error }, "[health] redis check failed")
    return { status: "error" }
  }
}

export async function GET() {
  const [databaseResult, redisResult] = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
  ])

  let database: DatabaseStatus
  if (databaseResult.status === "fulfilled") {
    database = databaseResult.value
  } else {
    logger.error(
      { err: databaseResult.reason },
      "[health] database probe crashed",
    )
    database = { status: "error" }
  }

  let redis: RedisStatus
  if (redisResult.status === "fulfilled") {
    redis = redisResult.value
  } else {
    logger.error({ err: redisResult.reason }, "[health] redis probe crashed")
    redis = { status: "error" }
  }

  const hasFailure = database.status === "error" || redis.status === "error"

  const checks = {
    status: hasFailure ? ("degraded" as const) : ("ok" as const),
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
    services: { database, redis },
  }

  return NextResponse.json(checks, {
    status: hasFailure ? 503 : 200,
  })
}
