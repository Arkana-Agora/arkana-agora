import { z } from "zod"
import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { getInterpretationModel } from "@/lib/ai/models"
import { withRetry } from "@/lib/ai/retry"
import { getSystemPrompt } from "@/lib/ai/prompts/system"
import { sanitizeInput } from "@/lib/ai/prompts/user"
import { prisma } from "@/lib/prisma"
import { getArcanaByNumber } from "@/data/arcana"
import type { ArcanaData } from "@/data/arcana"
import {
  requireAIClient,
  createQuotaReservation,
  sseResponse,
} from "@/app/api/v1/ai/_helpers"
import {
  checkAndIncrementDailyUsage,
  commitDailyAIUsage,
} from "@/services/ai-service"

export const dynamic = "force-dynamic"

const arcanaInterpretSchema = z.object({
  arcanaNumber: z.number().int().min(1).max(22),
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

  const quota = createQuotaReservation(reqId, auth.userId, "interpretation")
  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true, plan: true },
    })

    if (!user) {
      return apiError("USER_NOT_FOUND", "Usuario nao encontrado", reqId, 404)
    }

    const tier = (user.plan ?? "FREE").toUpperCase() as "FREE" | "PLUS"

    // Fail-fast: cliente IA inicia ANTES da quota — configuração quebrada
    // (AI_API_KEY ausente) não pode queimar leitura diária.
    const aiClientOrResponse = requireAIClient(reqId, "ai/arcana-interpret")
    if (aiClientOrResponse instanceof Response) return aiClientOrResponse
    const aiClient = aiClientOrResponse

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
    // NÃO marca quota como consumida aqui — o commit acontece após
    // o stream entregar pelo menos 1 token (evita consumir quota em falhas).

    const systemPrompt = getSystemPrompt(mode)
    const userPrompt = buildArcanaPrompt(arcanaData, mode, user.name)

    const encoder = new TextEncoder()
    // Abort do stream (cliente desconectou) aborta o iterator da IA
    // e impede enqueue em controlador já fechado.
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
            aiClient.chat.completions.create({
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

          // Completion sem tokens é falha: devolver quota e emitir erro
          // (não há persist aqui, mas `done` vazio enganaria o cliente).
          if (fullText === "") {
            await quota.tryRefund("ai/arcana-interpret")
            safeEnqueue(
              controller,
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", code: "AI_SERVICE_UNAVAILABLE", message: "Nao foi possivel gerar a interpretacao agora. Tente novamente em alguns minutos.", retryable: true })}\n\n`,
              ),
            )
            safeClose(controller)
            return
          }

          // Commit quota apenas após entregar pelo menos 1 token (sucesso real).
          await commitDailyAIUsage(auth.userId)

          safeEnqueue(
            controller,
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", cached: false })}\n\n`,
            ),
          )
          safeClose(controller)
        } catch (error) {
          if (streamAbort.signal.aborted) {
            return
          }
          logger.error(
            {
              reqId,
              err: error instanceof Error ? error : new Error(String(error)),
            },
            "[ai/arcana-interpret] erro no streaming",
          )
          if (fullText !== "") {
            await commitDailyAIUsage(auth.userId)
          } else {
            await quota.tryRefund("ai/arcana-interpret")
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
    })

    return sseResponse(stream)
  } catch (err) {
    logger.error({ reqId, err }, "[ai/arcana-interpret] erro interno")
    await quota.tryRefund("ai/arcana-interpret")
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
