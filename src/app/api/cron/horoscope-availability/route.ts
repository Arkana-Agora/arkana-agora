import { NextResponse } from "next/server"
import { logger, newReqId } from "@/lib/logger"
import {
  runHoroscopeAvailabilityCheck,
  type HoroscopeAvailabilitySummary,
} from "@/jobs/horoscope-availability-check"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// CRON de disponibilidade (T145/AC-24): 06:00 BRT = `0 9 * * *` UTC no
// vercel.json — verifica o conteúdo diário gerado pelo cron das 04:00 BRT.
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const expected = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")

  if (!expected || auth !== `Bearer ${expected}`) {
    logger.warn(
      { reqId },
      "[cron:horoscope-availability] autorizacao do cron falhou",
    )
    return NextResponse.json(
      {
        error: { code: "UNAUTHORIZED", message: "Nao autorizado" },
        meta: { requestId: reqId },
      },
      { status: 401 },
    )
  }

  let summary: HoroscopeAvailabilitySummary
  try {
    summary = await runHoroscopeAvailabilityCheck(reqId)
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[cron:horoscope-availability] falha ao executar o check",
    )
    return NextResponse.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Falha ao executar o check" },
        meta: { requestId: reqId },
      },
      { status: 500 },
    )
  }

  logger.info(
    { reqId, ...summary },
    "[cron:horoscope-availability] check executado",
  )

  const response = NextResponse.json(
    { ok: true, data: summary, meta: { requestId: reqId } },
    { status: 200 },
  )
  response.headers.set("cache-control", "no-store")
  return response
}
