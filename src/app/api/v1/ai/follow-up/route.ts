import { z } from "zod"
import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { getFollowUpModel } from "@/lib/ai/models"
import { withRetry } from "@/lib/ai/retry"
import { getSystemPrompt } from "@/lib/ai/prompts/system"
import { buildFollowUpPrompt } from "@/lib/ai/prompts/user"
import { prisma } from "@/lib/prisma"
import {
  requireAIClient,
  createQuotaReservation,
  sseResponse,
} from "@/app/api/v1/ai/_helpers"
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

  const quota = createQuotaReservation(reqId, auth.userId, "followUp")
  try {
    const ctx = await getFollowUpContext(interpretationId, auth.userId)
    if ("error" in ctx) {
      return apiError(ctx.error, "Erro ao buscar dados", reqId, ctx.status)
    }

    // Fail-fast: cliente IA inicia ANTES da quota — falha de
    // configuração/provider não pode queimar mensagem do plano.
    const aiClientOrResponse = requireAIClient(reqId, "ai/follow-up")
    if (aiClientOrResponse instanceof Response) return aiClientOrResponse
    const aiClient = aiClientOrResponse

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
    quota.markConsumed()

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
        let userMessageId: string | null = null
        let fullText = ""
        try {
          const userMessage = await prisma.followUpMessage.create({
            data: {
              interpretationId,
              role: "user",
              content: message,
            },
          })
          userMessageId = userMessage.id

          const aiResponse = await withRetry(() =>
            aiClient.chat.completions.create({
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

          // Completion sem tokens é falha: mesmo tratamento do catch —
          // compensa o turno do usuário persistido e devolve a quota,
          // senão o histórico guarda uma mensagem da IA em branco.
          if (fullText === "") {
            if (userMessageId) {
              try {
                await prisma.followUpMessage.deleteMany({
                  where: { id: userMessageId },
                })
              } catch (deleteErr) {
                logger.error(
                  { reqId, err: deleteErr },
                  "[ai/follow-up] falha ao remover mensagem do usuario",
                )
              }
            }
            await quota.tryRefund("ai/follow-up")
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", code: "AI_SERVICE_UNAVAILABLE", message: "Nao foi possivel gerar a resposta. Tente novamente.", retryable: true })}\n\n`,
              ),
            )
            controller.close()
            return
          }

          await saveAssistantFollowUpMessage(interpretationId, fullText)

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
          )
          controller.close()
        } catch (error) {
          logger.error(
            {
              reqId,
              err: error instanceof Error ? error : new Error(String(error)),
            },
            "[ai/follow-up] erro no streaming",
          )
          if (fullText === "") {
            // Nada entregue: compensa a mensagem do usuário persistida
            // (senão o retry duplica o turno no histórico) e devolve a quota.
            if (userMessageId) {
              try {
                await prisma.followUpMessage.deleteMany({
                  where: { id: userMessageId },
                })
              } catch (deleteErr) {
                logger.error(
                  { reqId, err: deleteErr },
                  "[ai/follow-up] falha ao remover mensagem do usuario",
                )
              }
            }
            await quota.tryRefund("ai/follow-up")
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", code: "AI_SERVICE_UNAVAILABLE", message: "Nao foi possivel gerar a resposta. Tente novamente.", retryable: true })}\n\n`,
            ),
          )
          controller.close()
        }
      },
    })

    return sseResponse(stream)
  } catch (err) {
    logger.error({ reqId, err }, "[ai/follow-up] erro interno")
    await quota.tryRefund("ai/follow-up")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
