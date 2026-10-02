import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { enforceCsrf } from "@/lib/middleware/csrf"
import { deleteObject } from "@/lib/r2"
import { r2KeyFromPublicUrl } from "@/lib/r2-public-url"

export const dynamic = "force-dynamic"

export async function DELETE(request: Request): Promise<Response> {
  const reqId = newReqId()

  const csrfError = enforceCsrf(request, reqId)
  if (csrfError) return csrfError

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { avatar: true },
    })

    if (user?.avatar) {
      const key = r2KeyFromPublicUrl(user.avatar)
      try {
        await deleteObject(key)
      } catch (err) {
        logger.warn(
          { err, reqId, key },
          "[avatar:delete] erro ao remover do R2 (objeto pode ja ter sido removido)",
        )
      }
    }

    await prisma.user.update({
      where: { id: auth.userId },
      data: { avatar: null },
    })

    logger.info(
      { reqId, userId: auth.userId },
      "[avatar:delete] avatar removido",
    )
    return Response.json({ message: "Avatar removido" })
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[avatar:delete] erro ao remover avatar",
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
