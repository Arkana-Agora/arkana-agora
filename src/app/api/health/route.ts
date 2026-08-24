import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { APP_VERSION } from "@/lib/version"

export const dynamic = "force-dynamic"

const DB_CHECK_TIMEOUT_MS = 5_000

type DatabaseStatus = { status: "ok" } | { status: "error" }

async function checkDatabase(): Promise<DatabaseStatus> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("database check timed out")),
          DB_CHECK_TIMEOUT_MS,
        )
      }),
    ])
    return { status: "ok" }
  } catch (error) {
    console.error("[health] database check failed", error)
    return { status: "error" }
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

export async function GET() {
  const database = await checkDatabase()
  const checks = {
    status: database.status === "ok" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
    services: { database },
  }

  return NextResponse.json(checks, {
    status: database.status === "ok" ? 200 : 503,
  })
}
