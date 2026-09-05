import { NextResponse } from "next/server"
import { logger, newReqId } from "@/lib/logger"
import {
  runHardDeleteJob,
  type HardDeleteSummary,
} from "@/jobs/hard-delete-accounts"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const expected = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")

  if (!expected || auth !== `Bearer ${expected}`) {
    logger.warn({ reqId }, "[cron:hard-delete] autorizacao do cron falhou")
    return NextResponse.json(
      {
        error: { code: "UNAUTHORIZED", message: "Nao autorizado" },
        meta: { requestId: reqId },
      },
      { status: 401 },
    )
  }

  let summary: HardDeleteSummary
  try {
    summary = await runHardDeleteJob(new Date(), reqId)
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[cron:hard-delete] falha ao executar o job",
    )
    return NextResponse.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Falha ao executar o job" },
        meta: { requestId: reqId },
      },
      { status: 500 },
    )
  }

  logger.info(
    { reqId, processed: summary.processed, failed: summary.failed },
    "[cron:hard-delete] job executado",
  )

  const response = NextResponse.json(
    { ok: true, data: summary, meta: { requestId: reqId } },
    { status: 200 },
  )
  response.headers.set("cache-control", "no-store")
  return response
}
