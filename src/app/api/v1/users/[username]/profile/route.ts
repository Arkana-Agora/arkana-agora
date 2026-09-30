import { optionalAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { readFollowCounts } from "@/lib/social/follow-lists"
import { parsePrivacy, usernameSchema } from "@/lib/validators/profile"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
): Promise<Response> {
  const reqId = newReqId()
  const { username } = await params

  const parsed = usernameSchema.safeParse(username)
  if (!parsed.success) {
    logger.info({ reqId }, "[profile:public] username invalido")
    return apiError("VALIDATION_ERROR", "Username invalido", reqId, 422)
  }

  try {
    // Single query: profile completo com user + privacy + campos de estado
    // (evita a chamada dupla findVisibleProfile + userProfile.findUnique)
    const profileData = await prisma.userProfile.findUnique({
      where: { username: parsed.data },
      select: {
        userId: true,
        username: true,
        bio: true,
        location: true,
        privacy: true,
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
            isBanned: true,
            deletedAt: true,
            isActive: true,
          },
        },
      },
    })
    if (!profileData) {
      return apiError("USER_NOT_FOUND", "Usuario nao encontrado", reqId, 404)
    }

    const privacy = parsePrivacy(profileData.privacy)
    if (!privacy) {
      logger.warn(
        { reqId, username: parsed.data },
        "[profile] privacy JSON invalido — 404 fail-closed",
      )
      return apiError("USER_NOT_FOUND", "Usuario nao encontrado", reqId, 404)
    }

    // LGPD / anti-timing: perfil privado / banido / soft-deleted / inativo → 404
    if (
      privacy.profileVisibility === "private" ||
      profileData.user.isBanned ||
      profileData.user.deletedAt ||
      profileData.user.isActive === false
    ) {
      return apiError("USER_NOT_FOUND", "Usuario nao encontrado", reqId, 404)
    }

    // statsVisibility: dono sempre vê; outros só se não for "private"
    const viewerId = await optionalAuth(request)
    const isOwner = viewerId === profileData.user.id
    const showStats = isOwner || privacy.statsVisibility !== "private"

    const response: Record<string, unknown> = {
      id: profileData.user.id,
      name: profileData.user.name,
      username: profileData.username,
      bio: profileData.bio,
      avatarUrl: profileData.user.avatar,
      plan: profileData.user.plan,
      location: profileData.location,
    }

    if (privacy.arcanaVisibility !== "private") {
      response.astrology = {
        sunSign: profileData.user.astrologicalSign,
        personalArcana: profileData.user.personalArcana,
        kinMaya: profileData.user.mayanKin,
      }
    }

    if (showStats) {
      const counts = await readFollowCounts(
        prisma,
        profileData.user.id,
        profileData.user.id,
      )
      response.followersCount = counts.followersCount
      response.followingCount = counts.followingCount
    }

    if (viewerId) {
      const link = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: profileData.user.id,
          },
        },
        select: { id: true },
      })
      response.isFollowing = link != null
    }

    return Response.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Authorization",
      },
    })
  } catch (error) {
    logger.error({ err: error, reqId }, "[profile:public] erro interno")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
