import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"

export const dynamic = "force-dynamic"

export async function PATCH(request: Request): Promise<Response> {
  const reqId = newReqId()
  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  let body: { fileKey?: string }
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

  if (!body.fileKey) {
    return Response.json(
      {
        error: { code: "VALIDATION_ERROR", message: "fileKey obrigatorio" },
        meta: { requestId: reqId },
      },
      { status: 422 },
    )
  }

  const expectedPrefix = `avatars/${auth.userId}/`
  if (!body.fileKey.startsWith(expectedPrefix) || body.fileKey.includes("..")) {
    logger.warn(
      { reqId, userId: auth.userId, fileKey: body.fileKey },
      "[avatar:confirm] fileKey invalido — possivel path traversal",
    )
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Chave de arquivo invalida",
        },
        meta: { requestId: reqId },
      },
      { status: 422 },
    )
  }

  try {
    const avatarUrl = `${process.env.R2_PUBLIC_URL ?? "https://r2.arkanaagora.com"}/${body.fileKey}`
    await prisma.user.update({
      where: { id: auth.userId },
      data: { avatar: avatarUrl },
    })

    logger.info(
      { reqId, userId: auth.userId },
      "[avatar:confirm] avatar atualizado",
    )
    return Response.json({ avatarUrl })
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[avatar:confirm] erro ao confirmar avatar",
    )
    return Response.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Erro interno" },
        meta: { requestId: reqId },
      },
      { status: 500 },
    )
  }
}
