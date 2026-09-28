import { NextResponse } from "next/server"
import { logger, newReqId } from "@/lib/logger"
import {
  runCounterReconcileJob,
  type CounterReconcileSummary,
} from "@/jobs/counter-reconcile"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const expected = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")

  if (!expected || auth !== `Bearer ${expected}`) {
    logger.warn(
      { reqId },
      "[cron:counter-reconcile] autorizacao do cron falhou",
    )
    return NextResponse.json(
      {
        error: { code: "UNAUTHORIZED", message: "Nao autorizado" },
        meta: { requestId: reqId },
      },
      { status: 401 },
    )
  }

  let summary: CounterReconcileSummary
  try {
    summary = await runCounterReconcileJob(reqId)
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[cron:counter-reconcile] falha ao executar o job",
    )
    return NextResponse.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Falha ao executar o job" },
        meta: { requestId: reqId },
      },
      { status: 500 },
    )
  }

  logger.info({ reqId, ...summary }, "[cron:counter-reconcile] job executado")

  const response = NextResponse.json(
    { ok: true, data: summary, meta: { requestId: reqId } },
    { status: 200 },
  )
  response.headers.set("cache-control", "no-store")
  return response
}
