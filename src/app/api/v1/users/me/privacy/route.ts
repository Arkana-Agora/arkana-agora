import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { privacySchema } from "@/lib/validators/profile"
import { requireAuth } from "@/app/api/v1/users/_helpers"

export const dynamic = "force-dynamic"

export async function PATCH(request: Request): Promise<Response> {
  const reqId = newReqId()
  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      {
        error: { code: "VALIDATION_ERROR", message: "Corpo invalido" },
        meta: { requestId: reqId },
      },
      { status: 422 },
    )
  }

  const parsed = privacySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados invalidos",
          details: parsed.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        meta: { requestId: reqId },
      },
      { status: 422 },
    )
  }

  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: auth.userId },
      select: { privacy: true },
    })

    const currentPrivacy = (profile?.privacy as Record<string, unknown>) ?? {}
    const updatedPrivacy = { ...currentPrivacy, ...parsed.data }

    await prisma.userProfile.upsert({
      where: { userId: auth.userId },
      create: { userId: auth.userId, privacy: updatedPrivacy },
      update: { privacy: updatedPrivacy },
    })

    logger.info({ reqId, userId: auth.userId }, "[privacy] config atualizada")
    return Response.json({ message: "Privacidade atualizada" })
  } catch (error) {
    logger.error({ err: error, reqId }, "[privacy] erro ao atualizar")
    return Response.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Erro interno" },
        meta: { requestId: reqId },
      },
      { status: 500 },
    )
  }
}
