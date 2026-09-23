import { z } from "zod"
import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { getAIClient } from "@/lib/ai/client"
import { getFollowUpModel } from "@/lib/ai/models"
import { withRetry } from "@/lib/ai/retry"
import { getSystemPrompt } from "@/lib/ai/prompts/system"
import { buildFollowUpPrompt } from "@/lib/ai/prompts/user"
import { prisma } from "@/lib/prisma"
import {
  getFollowUpContext,
  checkAndIncrementFollowUpUsage,
  saveAssistantFollowUpMessage,
} from "@/services/ai-service"

export const dynamic = "force-dynamic"

const followUpSchema = z.object({
  interpretationId: z.string().min(1),
  message: z.string().min(1).max(500),
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

  const parsed = followUpSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Parametros invalidos",
      reqId,
      422,
      parsed.error.flatten().fieldErrors,
    )
  }

  const { interpretationId, message } = parsed.data

  try {
    const ctx = await getFollowUpContext(interpretationId, auth.userId)
    if ("error" in ctx) {
      return apiError(ctx.error, "Erro ao buscar dados", reqId, ctx.status)
    }

    const limitResult = await checkAndIncrementFollowUpUsage(
      auth.userId,
      ctx.tier,
    )
    if (!limitResult.allowed) {
      return apiError(
        "FOLLOW_UP_LIMIT_REACHED",
        "Limite de mensagens de follow-up atingido",
        reqId,
        429,
        {
          remaining: limitResult.remaining,
          followUpLimit: limitResult.followUpLimit,
        },
      )
    }

    const systemPrompt = getSystemPrompt(
      ctx.interpretation.mode as "general" | "love" | "career" | "yesno",
    )
    const userPrompt = buildFollowUpPrompt({
      userName: ctx.user.name,
      originalReadingSummary: ctx.reading
        ? `${ctx.reading.deckId} - ${ctx.reading.spreadId}`
        : "Leitura",
      previousInterpretation: ctx.interpretation.content,
      conversationHistory: ctx.history,
      userMessage: message,
    })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await prisma.followUpMessage.create({
            data: {
              interpretationId,
              role: "user",
              content: message,
            },
          })

          const client = getAIClient()
          const aiResponse = await withRetry(() =>
            client.chat.completions.create({
              model: getFollowUpModel(),
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              stream: true,
              max_tokens: 1000,
              temperature: 0.7,
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

          await saveAssistantFollowUpMessage(interpretationId, fullText)

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
          )
          controller.close()
        } catch (error) {
          logger.error({ reqId, error }, "[ai/follow-up] erro no streaming")
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", code: "AI_SERVICE_UNAVAILABLE", message: "Nao foi possivel gerar a resposta. Tente novamente.", retryable: true })}\n\n`,
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
    logger.error({ reqId, err }, "[ai/follow-up] erro interno")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
