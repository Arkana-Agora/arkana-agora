import { z } from "zod"
import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { getInterpretationModel } from "@/lib/ai/models"
import { withRetry } from "@/lib/ai/retry"
import {
  requireAIClient,
  createQuotaReservation,
  sseResponse,
} from "@/app/api/v1/ai/_helpers"
import {
  getInterpretationContext,
  checkAndIncrementDailyUsage,
  buildInterpretationPrompt,
  lookupCachedInterpretation,
  persistInterpretation,
} from "@/services/ai-service"

export const dynamic = "force-dynamic"

const interpretSchema = z.object({
  readingId: z.string().min(1),
  mode: z.enum(["general", "love", "career", "yesno"]),
  // Revisão R7b: `question` já tinha cap (200) e `mood` não — texto de
  // tamanho ilimitado seguia para o hash de cache e para o prompt.
  mood: z.string().max(50).optional(),
  question: z.string().max(200).optional(),
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

  const parsed = interpretSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Parametros invalidos",
      reqId,
      422,
      parsed.error.flatten().fieldErrors,
    )
  }

  const { readingId, mode, mood, question } = parsed.data

  const quota = createQuotaReservation(reqId, auth.userId, "interpretation")
  try {
    const ctx = await getInterpretationContext(auth.userId, readingId)
    if ("error" in ctx) {
      return apiError(ctx.error, "Erro ao buscar dados", reqId, ctx.status)
    }

    // Fail-fast: se o cliente IA não inicializa (ex.: AI_API_KEY ausente),
    // responde 503 ANTES de consumir a quota diária.
    const aiClientOrResponse = requireAIClient(reqId, "ai/interpret")
    if (aiClientOrResponse instanceof Response) return aiClientOrResponse
    const aiClient = aiClientOrResponse

    const limitResult = await checkAndIncrementDailyUsage(auth.userId, ctx.tier)
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

    const { systemPrompt, userPrompt, cacheHash } = buildInterpretationPrompt(
      ctx,
      mode,
      mood,
      question,
    )

    const cached = await lookupCachedInterpretation(cacheHash, auth.userId)
    if (cached) {
      return Response.json({
        cached: true,
        content: cached.content,
        interpretationId: cached.id,
        tokensUsed: 0,
      })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let fullText = ""
        try {
          const aiResponse = await withRetry(() =>
            aiClient.chat.completions.create({
              model: getInterpretationModel(),
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              stream: true,
              max_tokens: mode === "yesno" ? 1500 : 4096,
              temperature: mode === "yesno" ? 0.4 : 0.7,
            }),
          )

          for await (const chunk of aiResponse) {
            const token = chunk.choices[0]?.delta?.content ?? ""
            if (token) {
              fullText += token
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "token", token })}\n\n`,
                ),
              )
            }
          }

          // Completion sem tokens (ex.: finish_reason content_filter) é
          // falha: nunca persistir/cache/vazio, devolver quota e emitir
          // erro — senão o usuário vê interpretação em branco em cache
          // para sempre (lookupCachedInterpretation devolve o row vazio).
          if (fullText === "") {
            await quota.tryRefund("ai/interpret")
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", code: "AI_SERVICE_UNAVAILABLE", message: "Nao foi possivel gerar a interpretacao agora. Tente novamente em alguns minutos.", retryable: true })}\n\n`,
              ),
            )
            controller.close()
            return
          }

          const saved = await persistInterpretation({
            readingId,
            userId: auth.userId,
            mode,
            mood: mood ?? null,
            question: question ?? null,
            content: fullText,
            cacheHash,
            tokensUsed: 0,
          })

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                cached: false,
                interpretationId: (saved as { id?: string })?.id ?? null,
              })}\n\n`,
            ),
          )
          controller.close()
        } catch (error) {
          logger.error(
            {
              reqId,
              err: error instanceof Error ? error : new Error(String(error)),
            },
            "[ai/interpret] erro no streaming",
          )
          if (fullText === "") {
            await quota.tryRefund("ai/interpret")
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", code: "AI_SERVICE_UNAVAILABLE", message: "Nao foi possivel gerar a interpretacao agora. Tente novamente em alguns minutos.", retryable: true })}\n\n`,
            ),
          )
          controller.close()
        }
      },
    })

    return sseResponse(stream)
  } catch (err) {
    logger.error({ reqId, err }, "[ai/interpret] erro interno")
    await quota.tryRefund("ai/interpret")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
