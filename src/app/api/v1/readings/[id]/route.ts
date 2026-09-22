import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const { id } = await params

  try {
    const reading = await prisma.reading.findFirst({
      where: {
        id,
        OR: [{ userId: auth.userId }, { isPublic: true }],
      },
      include: { cards: true },
    })

    if (!reading) {
      logger.info(
        { reqId, readingId: id },
        "[reading:get] nao encontrada ou acesso negado",
      )
      return apiError("NOT_FOUND", "Reading nao encontrada", reqId, 404)
    }

    return Response.json({ reading })
  } catch (err) {
    logger.error({ reqId, err }, "[reading:get] erro ao buscar reading")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
