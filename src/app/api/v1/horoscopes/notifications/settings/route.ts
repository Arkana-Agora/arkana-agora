import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { enforceCsrf } from "@/lib/middleware/csrf"
import { enforceSocialLimit } from "@/lib/middleware/rate-limit"
import { prisma } from "@/lib/prisma"
import {
  horoscopeNotificationPatchSchema,
  type HoroscopeNotificationPatch,
  type HoroscopeNotificationSettings,
} from "@/lib/horoscopes/notification-settings"

export const dynamic = "force-dynamic"

/**
 * Settings de notificação de horóscopo (T103/RF-HORO-008):
 * `GET` devolve o estado atual (defaults do schema quando não há row —
 * ocidental on, chinês/maia off, 07:00) para a UI nunca exibir estado
 * obsoleto; `PATCH` valida via Zod compartilhado
 * (`src/lib/horoscopes/notification-settings.ts` — mesmo contrato do hook)
 * e faz upsert por `userId` único — campos ausentes não são tocados
 * (create herda os defaults das colunas).
 *
 * Ordem canônica (security.md): CSRF → auth → Zod → rate `notification`
 * (60/min, janela compartilhada das rotas de notificação T083/T084).
 */
const DEFAULT_SETTINGS = {
  westernEnabled: true,
  chineseEnabled: false,
  mayaEnabled: false,
  hour: 7,
} as const

function toSettings(
  row: HoroscopeNotificationSettings | null,
): HoroscopeNotificationSettings {
  if (row === null) return { ...DEFAULT_SETTINGS }
  return {
    westernEnabled: row.westernEnabled,
    chineseEnabled: row.chineseEnabled,
    mayaEnabled: row.mayaEnabled,
    hour: row.hour,
  }
}

// Strip de `undefined` (exactOptionalPropertyTypes): o patch zod parcial
// produz `T | undefined`, mas o update input do Prisma não aceita
// `undefined` explícito.
function patchOf(
  body: HoroscopeNotificationPatch,
): Partial<HoroscopeNotificationSettings> {
  return {
    ...(body.westernEnabled !== undefined
      ? { westernEnabled: body.westernEnabled }
      : {}),
    ...(body.chineseEnabled !== undefined
      ? { chineseEnabled: body.chineseEnabled }
      : {}),
    ...(body.mayaEnabled !== undefined
      ? { mayaEnabled: body.mayaEnabled }
      : {}),
    ...(body.hour !== undefined ? { hour: body.hour } : {}),
  }
}

export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  try {
    const row = await prisma.horoscopeNotification.findUnique({
      where: { userId: auth.userId },
    })
    return Response.json({ data: { settings: toSettings(row) } })
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[horoscopes:notifications] erro ao ler settings",
    )
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const reqId = newReqId()

  const csrfError = enforceCsrf(request, reqId)
  if (csrfError) return csrfError

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return apiError(
      "VALIDATION_ERROR",
      "Corpo da requisição inválido",
      reqId,
      422,
    )
  }

  const parsed = horoscopeNotificationPatchSchema.safeParse(raw)
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Body inválido", reqId, 422)
  }

  const rate = await enforceSocialLimit({
    limit: "notification",
    userId: auth.userId,
    reqId,
  })
  if (!rate.allowed) return rate.response

  const patch = patchOf(parsed.data)

  try {
    const row = await prisma.horoscopeNotification.upsert({
      where: { userId: auth.userId },
      create: { userId: auth.userId, ...patch },
      update: patch,
    })
    return Response.json({ data: { settings: toSettings(row) } })
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[horoscopes:notifications] erro ao salvar settings",
    )
    return apiError(
      "INTERNAL_ERROR",
      "Erro interno",
      reqId,
      500,
      undefined,
      rate.headers,
    )
  }
}
