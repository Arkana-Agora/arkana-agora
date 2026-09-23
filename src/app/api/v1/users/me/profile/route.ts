import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { updateProfileSchema } from "@/lib/validators/profile"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { calculateZodiacSign } from "@/lib/calculations/zodiac"
import { calculateKinMaya } from "@/lib/calculations/kin-maya"
import { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()
  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        name: true,
        displayName: true,
        avatar: true,
        email: true,
        plan: true,
        birthDate: true,
        astrologicalSign: true,
        mayanKin: true,
        personalArcana: true,
      },
    })

    if (!user) {
      return Response.json(
        {
          error: { code: "USER_NOT_FOUND", message: "Usuario nao encontrado" },
          meta: { requestId: reqId },
        },
        { status: 404 },
      )
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId: auth.userId },
      select: {
        username: true,
        bio: true,
        birthPlace: true,
        location: true,
        website: true,
        socialLinks: true,
        privacy: true,
      },
    })

    const response: Record<string, unknown> = { ...user }
    if (profile) {
      response.username = profile.username
      response.bio = profile.bio
      response.birthPlace = profile.birthPlace
      response.location = profile.location
      response.website = profile.website
      response.socialLinks = profile.socialLinks
      response.privacy = profile.privacy
    }

    return Response.json(response)
  } catch (error) {
    logger.error({ err: error, reqId }, "[profile:me] erro interno")
    return Response.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Erro interno" },
        meta: { requestId: reqId },
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const reqId = newReqId()
  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    logger.info({ reqId }, "[profile:me] corpo invalido")
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Corpo da requisicao invalido",
        },
        meta: { requestId: reqId },
      },
      { status: 422 },
    )
  }

  const parsed = updateProfileSchema.safeParse(body)
  if (!parsed.success) {
    logger.info({ reqId }, "[profile:me] validacao falhou")
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados de entrada invalidos",
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

  const data = parsed.data

  try {
    const userUpdates: Record<string, unknown> = {}
    if (data.displayName) userUpdates.displayName = data.displayName
    if (data.birthDate) {
      const bd = new Date(data.birthDate)
      userUpdates.birthDate = bd
      userUpdates.astrologicalSign = calculateZodiacSign(bd)
      userUpdates.mayanKin = calculateKinMaya(bd)?.toString()
      userUpdates.personalArcana = null
    } else if (data.birthDate === "") {
      userUpdates.birthDate = null
      userUpdates.astrologicalSign = null
      userUpdates.mayanKin = null
      userUpdates.personalArcana = null
    }
    if (data.birthPlace !== undefined)
      userUpdates.birthPlace = data.birthPlace || null

    const profileUpdates: Record<string, unknown> = {}
    if (data.bio !== undefined) profileUpdates.bio = data.bio || null
    if (data.location !== undefined)
      profileUpdates.location = data.location || null
    if (data.website !== undefined)
      profileUpdates.website = data.website || null
    if (data.username !== undefined)
      profileUpdates.username = data.username || null

    const hasUserUpdates = Object.keys(userUpdates).length > 0
    const hasProfileUpdates = Object.keys(profileUpdates).length > 0

    if (hasUserUpdates || hasProfileUpdates) {
      await prisma.$transaction(async (tx) => {
        if (hasUserUpdates) {
          await tx.user.update({
            where: { id: auth.userId },
            data: userUpdates,
          })
        }
        if (hasProfileUpdates) {
          await tx.userProfile.upsert({
            where: { userId: auth.userId },
            create: { userId: auth.userId, ...profileUpdates },
            update: profileUpdates,
          })
        }
      })
    }

    logger.info(
      { reqId, userId: auth.userId },
      "[profile:me] perfil atualizado",
    )
    return Response.json({ message: "Perfil atualizado" })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        {
          error: { code: "USERNAME_TAKEN", message: "Username ja esta em uso" },
          meta: { requestId: reqId },
        },
        { status: 409 },
      )
    }
    logger.error({ err: error, reqId }, "[profile:me] erro ao atualizar")
    return Response.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Erro interno" },
        meta: { requestId: reqId },
      },
      { status: 500 },
    )
  }
}
