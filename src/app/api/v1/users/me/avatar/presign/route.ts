import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { generatePresignedUrl } from "@/lib/r2"
import { avatarPresignSchema } from "@/lib/validators/profile"

export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
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

  const parsed = avatarPresignSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Formato nao suportado",
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

  const ext = parsed.data.contentType.split("/")[1]
  const key = `avatars/${auth.userId}/${Date.now()}.${ext}`

  try {
    const uploadUrl = await generatePresignedUrl(key, parsed.data.contentType)
    return Response.json({ uploadUrl, key })
  } catch (error) {
    logger.error({ err: error, reqId }, "[avatar:presign] erro ao gerar URL")
    return Response.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Erro interno" },
        meta: { requestId: reqId },
      },
      { status: 500 },
    )
  }
}
