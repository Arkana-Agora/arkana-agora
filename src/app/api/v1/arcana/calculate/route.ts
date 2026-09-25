import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import {
  calculatePersonalArcana,
  explainPersonalArcana,
} from "@/lib/arcana/calculate"
import { getArcanaByNumber } from "@/data/arcana"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true, birthDate: true, personalArcana: true },
    })

    if (!user) {
      return apiError("USER_NOT_FOUND", "Usuario nao encontrado", reqId, 404)
    }

    if (!user.birthDate || !user.name) {
      return apiError(
        "INCOMPLETE_PROFILE",
        "Data de nascimento e nome sao obrigatorios para calcular o arcano",
        reqId,
        422,
      )
    }

    const recomputed = calculatePersonalArcana(user.birthDate, user.name)

    if (recomputed === null) {
      return apiError(
        "CALCULATION_ERROR",
        "Nao foi possivel calcular o arcano pessoal",
        reqId,
        500,
      )
    }

    const arcanaNumber = recomputed

    const arcanaData = getArcanaByNumber(arcanaNumber)
    const explanation = explainPersonalArcana(user.birthDate, user.name)

    if (recomputed !== user.personalArcana) {
      try {
        // CAS contra o valor observado: se outra escrita (ex.: PATCH de perfil)
        // atualizou personalArcana entre a leitura e este update, a condicao
        // nao casa e nada e sobrescrito. Serve sempre o valor canonico.
        await prisma.user.updateMany({
          where: { id: auth.userId, personalArcana: user.personalArcana },
          data: { personalArcana: recomputed },
        })
        // Re-read for logging/verification only; response returns canonical recomputed value
        const refreshed = await prisma.user.findUnique({
          where: { id: auth.userId },
          select: { personalArcana: true },
        })
        if (refreshed && refreshed.personalArcana !== recomputed) {
          logger.warn(
            { reqId, expected: recomputed, actual: refreshed.personalArcana },
            "[arcana/calculate] self-heal CAS succeeded but DB value differs (race)",
          )
        }
      } catch (persistErr) {
        logger.warn(
          { reqId, err: persistErr },
          "[arcana/calculate] falha ao reconciliar arcano pessoal",
        )
      }
    }

    try {
      await prisma.arcanaCalculation.create({
        data: {
          userId: auth.userId,
          birthDate: user.birthDate,
          fullName: user.name,
          reductionDate: explanation.reductionDate,
          reductionName: explanation.reductionName,
          arcanaNumber,
          arcanaName: arcanaData?.name ?? String(arcanaNumber),
          description: arcanaData
            ? `${arcanaData.upright} | Reverso: ${arcanaData.reversed}`.slice(
                0,
                2000,
              )
            : "",
        },
      })
    } catch (historyErr) {
      logger.warn(
        { reqId, err: historyErr },
        "[arcana/calculate] falha ao persistir historico",
      )
    }

    return Response.json({
      arcana: arcanaNumber,
      arcanaData,
      name: user.name,
      birthDate: user.birthDate,
      reductionDate: explanation.reductionDate,
      reductionName: explanation.reductionName,
      meta: { requestId: reqId },
    })
  } catch (err) {
    logger.error({ reqId, err }, "[arcana/calculate] erro interno")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
