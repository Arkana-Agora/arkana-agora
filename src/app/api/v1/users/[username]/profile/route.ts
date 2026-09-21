import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { usernameSchema } from "@/lib/validators/profile"
import type { PrivacySettings } from "@/lib/validators/profile"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
): Promise<Response> {
  const reqId = newReqId()
  const { username } = await params

  const parsed = usernameSchema.safeParse(username)
  if (!parsed.success) {
    logger.info({ reqId }, "[profile:public] username invalido")
    return Response.json(
      {
        error: { code: "VALIDATION_ERROR", message: "Username invalido" },
        meta: { requestId: reqId },
      },
      { status: 422 },
    )
  }

  try {
    const profile = await prisma.userProfile.findUnique({
      where: { username: parsed.data },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatar: true,
            plan: true,
            birthDate: true,
            astrologicalSign: true,
            mayanKin: true,
            personalArcana: true,
          },
        },
      },
    })

    if (!profile) {
      return Response.json(
        {
          error: { code: "USER_NOT_FOUND", message: "Usuario nao encontrado" },
          meta: { requestId: reqId },
        },
        { status: 404 },
      )
    }

    const privacy = (profile.privacy as PrivacySettings) ?? {}
    const isPublic = privacy.profileVisibility !== "private"

    if (!isPublic) {
      return Response.json(
        {
          error: { code: "USER_NOT_FOUND", message: "Usuario nao encontrado" },
          meta: { requestId: reqId },
        },
        { status: 404 },
      )
    }

    const response: Record<string, unknown> = {
      id: profile.user.id,
      name: profile.user.name,
      username: profile.username,
      bio: profile.bio,
      avatarUrl: profile.user.avatar,
      plan: profile.user.plan,
      location: profile.location,
    }

    if (privacy.arcanaVisibility !== "private") {
      response.astrology = {
        sunSign: profile.user.astrologicalSign,
        personalArcana: profile.user.personalArcana,
        kinMaya: profile.user.mayanKin,
      }
    }

    return Response.json(response)
  } catch (error) {
    logger.error({ err: error, reqId }, "[profile:public] erro interno")
    return Response.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Erro interno" },
        meta: { requestId: reqId },
      },
      { status: 500 },
    )
  }
}
