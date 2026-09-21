import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { usernameSchema } from "@/lib/validators/profile"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
): Promise<Response> {
  const reqId = newReqId()
  const { username } = await params

  const parsed = usernameSchema.safeParse(username)
  if (!parsed.success) {
    logger.info({ reqId }, "[check-username] username invalido")
    return Response.json(
      {
        error: { code: "VALIDATION_ERROR", message: "Username invalido" },
        meta: { requestId: reqId },
      },
      { status: 422 },
    )
  }

  try {
    const existing = await prisma.userProfile.findUnique({
      where: { username: parsed.data },
      select: { id: true },
    })

    return Response.json({ available: existing === null })
  } catch (error) {
    logger.error({ err: error, reqId }, "[check-username] erro interno")
    return Response.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Erro interno" },
        meta: { requestId: reqId },
      },
      { status: 500 },
    )
  }
}
