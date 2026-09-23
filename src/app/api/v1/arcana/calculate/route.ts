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

    const arcanaNumber =
      user.personalArcana ?? calculatePersonalArcana(user.birthDate, user.name)

    if (arcanaNumber === null) {
      return apiError(
        "CALCULATION_ERROR",
        "Nao foi possivel calcular o arcano pessoal",
        reqId,
        500,
      )
    }

    const arcanaData = getArcanaByNumber(arcanaNumber)
    const explanation = explainPersonalArcana(user.birthDate, user.name)

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
