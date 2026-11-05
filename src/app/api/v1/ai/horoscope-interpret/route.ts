import { z } from "zod"
import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getInterpretationModel } from "@/lib/ai/models"
import { withRetry } from "@/lib/ai/retry"
import { checkDailyAILimit } from "@/lib/ai/rate-limit"
import {
  requireAIClient,
  createQuotaReservation,
  sseResponse,
} from "@/app/api/v1/ai/_helpers"
import {
  HOROSCOPE_TYPES,
  buildHoroscopeInterpretationPrompt,
} from "@/lib/horoscopes/prompts"
import { buildFallbackFor, MAYAN_KIN_COUNT } from "@/lib/horoscopes/fallback"
import { CHINESE_ANIMALS } from "@/lib/horoscopes/chinese"
import { WESTERN_SIGNS } from "@/lib/horoscopes/western"
import { horoscopeContentShape } from "@/lib/horoscopes/validation"
import {
  defaultHoroscopeDate,
  horoscopePeriodFields,
  refineHoroscopeDate,
} from "@/app/api/v1/horoscopes/_helpers"

export const dynamic = "force-dynamic"

function isKnownSignId(type: string, signId: string): boolean {
  if (type === "western")
    return WESTERN_SIGNS.some((sign) => sign.id === signId)
  if (type === "chinese")
    return CHINESE_ANIMALS.some((animal) => animal.id === signId)
  const kin = Number(signId)
  return Number.isInteger(kin) && kin >= 1 && kin <= MAYAN_KIN_COUNT
}

// RF-HORO-006/AC-17 (T101): interpretação detalhada via IA — mesmo
// pipeline SSE da SPEC-004, consome 1 unidade da cota diária de IA via
// checkDailyAILimit (429 AI_DAILY_LIMIT_REACHED) e só persiste em quota o
// que foi entregue. `date` é a key do HoroscopeContent (daily YYYY-MM-DD,
// weekly YYYY-Www, monthly YYYY-MM); ausente → data civil BRT do período.
// `signId` validado contra o catálogo do tipo (superRefine): signId
// desconhecido vira 422 ANTES de consumir quota (review; caps de tamanho
// também evitam payloads gigantes no lookup).
const horoscopeInterpretSchema = z
  .object({
    type: z.enum(HOROSCOPE_TYPES),
    signId: z.string().min(1).max(32),
    // fase 5 (chinês): desambigua as 5 rows por elemento; ocidental omite
    element: z.string().min(1).max(16).nullish(),
    ...horoscopePeriodFields,
  })
  .superRefine(refineHoroscopeDate)
  .superRefine((data, ctx) => {
    if (!isKnownSignId(data.type, data.signId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["signId"],
        message: "signId desconhecido para o tipo informado",
      })
    }
  })

export async function POST(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("INVALID_BODY", "Body invalido", reqId, 400)
  }

  const parsed = horoscopeInterpretSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Parametros invalidos",
      reqId,
      422,
      parsed.error.flatten().fieldErrors,
    )
  }

  const { type, signId, element, period } = parsed.data
  const date = parsed.data.date ?? defaultHoroscopeDate(period)

  const quota = createQuotaReservation(reqId, auth.userId, "interpretation")
  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { plan: true, name: true },
    })
    if (!user) return apiError("UNAUTHORIZED", "Sessao invalida", reqId, 401)

    // Fail-fast: se o cliente IA não inicializa (AI_API_KEY ausente),
    // responde 503 ANTES de consumir a quota diária.
    const aiClientOrResponse = requireAIClient(reqId, "ai/horoscope-interpret")
    if (aiClientOrResponse instanceof Response) return aiClientOrResponse
    const aiClient = aiClientOrResponse

    const limitResult = await checkDailyAILimit(
      auth.userId,
      (user.plan ?? "FREE").toUpperCase(),
    )
    if (!limitResult.allowed) {
      return apiError(
        "AI_DAILY_LIMIT_REACHED",
        "Limite diario de interpretacoes atingido",
        reqId,
        429,
        {
          remaining: limitResult.remaining,
          totalLimit: limitResult.totalLimit,
        },
      )
    }
    quota.markConsumed()

    // Contexto RF-HORO-006: row do horóscopo (T093) ou fallback T032
    // sintetizado — o prompt nunca fica sem base (signo inválido → null).
    const row = await prisma.horoscopeContent.findFirst({
      where: {
        type,
        signId,
        period,
        date,
        ...(element != null ? { element } : {}),
      },
      select: { content: true },
    })
    const rowContent = row ? horoscopeContentShape.safeParse(row.content) : null
    let content = rowContent?.success
      ? {
          general: rowContent.data.general,
          love: rowContent.data.love,
          career: rowContent.data.career,
          health: rowContent.data.health,
        }
      : null
    if (content === null) {
      try {
        content = buildFallbackFor({
          type,
          signId,
          element,
          period,
          date,
        })
      } catch {
        content = null
      }
    }

    const prompt = buildHoroscopeInterpretationPrompt({
      type,
      signId,
      element,
      period,
      date,
      content,
      profileName: user.name,
    })

    const encoder = new TextEncoder()
    // Abort duplo (review julik): cancel() do stream (cliente
    // desconectou) aborta o iterator da IA e impede enqueue em controlador
    // já fechado — sem isso o consumo de tokens continuava em background.
    const streamAbort = new AbortController()
    const safeEnqueue = (
      controller: ReadableStreamDefaultController<Uint8Array>,
      bytes: Uint8Array,
    ): void => {
      try {
        controller.enqueue(bytes)
      } catch {
        // controlador já fechado (cliente desconectou) — ignora
      }
    }
    const safeClose = (
      controller: ReadableStreamDefaultController<Uint8Array>,
    ): void => {
      try {
        controller.close()
      } catch {
        // já fechado — ignora
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        let fullText = ""
        try {
          const aiResponse = await withRetry(() =>
            aiClient.chat.completions.create(
              {
                model: getInterpretationModel(),
                messages: [
                  { role: "system", content: prompt.system },
                  { role: "user", content: prompt.user },
                ],
                stream: true,
                max_tokens: 4096,
                temperature: 0.7,
              },
              { signal: streamAbort.signal },
            ),
          )

          for await (const chunk of aiResponse) {
            if (streamAbort.signal.aborted) break
            const token = chunk.choices[0]?.delta?.content ?? ""
            if (token) {
              fullText += token
              safeEnqueue(
                controller,
                encoder.encode(
                  `data: ${JSON.stringify({ type: "token", token })}\n\n`,
                ),
              )
            }
          }

          if (streamAbort.signal.aborted) {
            // Cliente desconectou: entrega parcial consumiu a quota (mesma
            // política do empty-completion guard — refund só quando nada
            // foi entregue). Não tenta fechar/enqueue após cancel.
            return
          }

          // Completion sem tokens é falha (padrão SPRINT2-F3): nunca
          // entregar vazio — devolver a quota e emitir erro retryable.
          if (fullText === "") {
            await quota.tryRefund("ai/horoscope-interpret")
            safeEnqueue(
              controller,
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", code: "AI_SERVICE_UNAVAILABLE", message: "Nao foi possivel gerar a interpretacao agora. Tente novamente em alguns minutos.", retryable: true })}\n\n`,
              ),
            )
            safeClose(controller)
            return
          }

          safeEnqueue(
            controller,
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
          )
          safeClose(controller)
        } catch (error) {
          if (streamAbort.signal.aborted) {
            // desconexão do cliente não é erro de serviço
            return
          }
          logger.error(
            {
              reqId,
              err: error instanceof Error ? error : new Error(String(error)),
            },
            "[ai/horoscope-interpret] erro no streaming",
          )
          if (fullText === "") {
            await quota.tryRefund("ai/horoscope-interpret")
          }
          safeEnqueue(
            controller,
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", code: "AI_SERVICE_UNAVAILABLE", message: "Nao foi possivel gerar a interpretacao agora. Tente novamente em alguns minutos.", retryable: true })}\n\n`,
            ),
          )
          safeClose(controller)
        }
      },
      cancel() {
        streamAbort.abort()
      },
    })

    return sseResponse(stream)
  } catch (err) {
    logger.error({ reqId, err }, "[ai/horoscope-interpret] erro interno")
    await quota.tryRefund("ai/horoscope-interpret")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
