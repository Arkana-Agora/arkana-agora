import { z } from "zod"
import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { getAIClient } from "@/lib/ai/client"
import { getInterpretationModel } from "@/lib/ai/models"
import { withRetry } from "@/lib/ai/retry"
import { getSystemPrompt } from "@/lib/ai/prompts/system"
import { sanitizeInput } from "@/lib/ai/prompts/user"
import { prisma } from "@/lib/prisma"
import { getArcanaByNumber } from "@/data/arcana"
import type { ArcanaData } from "@/data/arcana"
import { checkAndIncrementDailyUsage } from "@/services/ai-service"

export const dynamic = "force-dynamic"

const arcanaInterpretSchema = z.object({
  arcanaNumber: z.number().int().min(0).max(21),
  mode: z.enum(["general", "love", "career", "spiritual"]).default("general"),
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

  const parsed = arcanaInterpretSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Parametros invalidos",
      reqId,
      422,
      parsed.error.flatten().fieldErrors,
    )
  }

  const { arcanaNumber, mode } = parsed.data

  const arcanaData = getArcanaByNumber(arcanaNumber)
  if (!arcanaData) {
    return apiError("INVALID_ARCANA", "Arcano invalido", reqId, 422)
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true, plan: true },
    })

    if (!user) {
      return apiError("USER_NOT_FOUND", "Usuario nao encontrado", reqId, 404)
    }

    const tier = (user.plan ?? "FREE").toUpperCase() as "FREE" | "PLUS"
    const limitResult = await checkAndIncrementDailyUsage(auth.userId, tier)
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

    const systemPrompt = getSystemPrompt(mode)
    const userPrompt = buildArcanaPrompt(arcanaData, mode, user.name)

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const client = getAIClient()
          const aiResponse = await withRetry(() =>
            client.chat.completions.create({
              model: getInterpretationModel(),
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              stream: true,
              max_tokens: 2000,
              temperature: 0.7,
            }),
          )

          for await (const chunk of aiResponse) {
            const token = chunk.choices[0]?.delta?.content ?? ""
            if (token) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "token", token })}\n\n`,
                ),
              )
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", cached: false })}\n\n`,
            ),
          )
          controller.close()
        } catch (error) {
          logger.error(
            { reqId, error },
            "[ai/arcana-interpret] erro no streaming",
          )
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
    logger.error({ reqId, err }, "[ai/arcana-interpret] erro interno")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}

function buildArcanaPrompt(
  arcanaData: ArcanaData,
  mode: string,
  userName: string,
): string {
  const modeLabel: Record<string, string> = {
    general: "leitura geral",
    love: "amor e relacionamentos",
    career: "carreira e profissao",
    spiritual: "espiritualidade e proposito",
  }

  const safeName = sanitizeInput(userName)
  return `Voce e um leitor de tarot experiente e empatico. Interprete o arcano pessoal de ${safeName}.

Arcano: ${arcanaData.name}
Significado upright: ${arcanaData.upright}
Significado reversed: ${arcanaData.reversed}
Elemento: ${arcanaData.element}
Planeta: ${arcanaData.planet}

Foco da interpretacao: ${modeLabel[mode] ?? "leitura geral"}

Forneça uma interpretacao personalizada e profunda (200-400 palavras) em portugues do Brasil. Seja esotericamente preciso e empatico.`
}
