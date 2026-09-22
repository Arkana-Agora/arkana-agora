import { z } from "zod"
import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { getAIClient } from "@/lib/ai/client"
import { withRetry } from "@/lib/ai/retry"
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
  mood: z.string().optional(),
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

  try {
    const ctx = await getInterpretationContext(auth.userId, readingId)
    if ("error" in ctx) {
      return apiError(ctx.error, "Erro ao buscar dados", reqId, ctx.status)
    }

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
        try {
          const client = getAIClient()
          const aiResponse = await withRetry(() =>
            client.chat.completions.create({
              model: "gpt-4o",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              stream: true,
              max_tokens: mode === "yesno" ? 1500 : 4096,
              temperature: mode === "yesno" ? 0.4 : 0.7,
            }),
          )

          let fullText = ""
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

          await persistInterpretation({
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
              `data: ${JSON.stringify({ type: "done", cached: false })}\n\n`,
            ),
          )
          controller.close()
        } catch (error) {
          logger.error({ reqId, error }, "[ai/interpret] erro no streaming")
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", code: "AI_SERVICE_UNAVAILABLE", message: "Nao foi possivel gerar a interpretacao agora. Tente novamente em alguns minutos.", retryable: true })}\n\n`,
            ),
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (err) {
    logger.error({ reqId, err }, "[ai/interpret] erro interno")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
