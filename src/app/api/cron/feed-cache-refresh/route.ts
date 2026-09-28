import { NextResponse } from "next/server"
import { logger, newReqId } from "@/lib/logger"
import {
  runFeedCacheRefresh,
  type FeedCacheRefreshSummary,
} from "@/jobs/feed-cache-refresh"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const expected = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")

  if (!expected || auth !== `Bearer ${expected}`) {
    logger.warn(
      { reqId },
      "[cron:feed-cache-refresh] autorizacao do cron falhou",
    )
    return NextResponse.json(
      {
        error: { code: "UNAUTHORIZED", message: "Nao autorizado" },
        meta: { requestId: reqId },
      },
      { status: 401 },
    )
  }

  let summary: FeedCacheRefreshSummary
  try {
    summary = await runFeedCacheRefresh()
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[cron:feed-cache-refresh] falha ao executar o job",
    )
    return NextResponse.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Falha ao executar o job" },
        meta: { requestId: reqId },
      },
      { status: 500 },
    )
  }

  logger.info({ reqId, ...summary }, "[cron:feed-cache-refresh] job executado")

  const response = NextResponse.json(
    { ok: true, data: summary, meta: { requestId: reqId } },
    { status: 200 },
  )
  response.headers.set("cache-control", "no-store")
  return response
}
