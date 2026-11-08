import { NextResponse } from "next/server"
import { logger, newReqId } from "@/lib/logger"
import {
  runHoroscopeGenerationJob,
  type HoroscopeGenerationSummary,
} from "@/jobs/horoscope-generation"
import { enforceCsrf } from "@/lib/middleware/csrf"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import type { RequireAuth } from "@/app/api/v1/users/_helpers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const expected = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")

  if (!expected || auth !== `Bearer ${expected}`) {
    logger.warn(
      { reqId },
      "[cron:horoscope-generation] autorizacao do cron falhou",
    )
    return NextResponse.json(
      {
        error: { code: "UNAUTHORIZED", message: "Nao autorizado" },
        meta: { requestId: reqId },
      },
      { status: 401 },
    )
  }

  let summary: HoroscopeGenerationSummary
  try {
    summary = await runHoroscopeGenerationJob(reqId)
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[cron:horoscope-generation] falha ao executar o job",
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
    { reqId, ...summary },
    "[cron:horoscope-generation] job executado",
  )

  const response = NextResponse.json(
    { ok: true, data: summary, meta: { requestId: reqId } },
    { status: 200 },
  )
  response.headers.set("cache-control", "no-store")
  return response
}

// POST endpoint for manual triggering with CSRF protection and auth
// (Addresses security review: CSRF protection for future job triggers)
export async function POST(request: Request): Promise<Response> {
  const reqId = newReqId()

  // CSRF protection (double-submit cookie pattern)
  const csrfResult = enforceCsrf(request, reqId)
  if (csrfResult instanceof Response) return csrfResult

  // Authentication (requires authenticated user)
  const authFn: RequireAuth = requireAuth
  const auth = await authFn(request, reqId)
  if (auth instanceof Response) return auth

  let summary: HoroscopeGenerationSummary
  try {
    summary = await runHoroscopeGenerationJob(reqId)
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[cron:horoscope-generation] falha ao executar o job (manual trigger)",
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
    { reqId, ...summary, triggeredBy: auth.userId },
    "[cron:horoscope-generation] job executado (manual trigger)",
  )

  return NextResponse.json(
    { ok: true, data: summary, meta: { requestId: reqId } },
    { status: 200 },
  )
}
