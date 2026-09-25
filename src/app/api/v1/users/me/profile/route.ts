import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { updateProfileSchema } from "@/lib/validators/profile"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { calculateZodiacSign } from "@/lib/calculations/zodiac"
import { calculateKinMaya } from "@/lib/calculations/kin-maya"
import { calculatePersonalArcana } from "@/lib/arcana/calculate"
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
    const userUpdates: Prisma.UserUpdateInput = {}
    if (data.displayName !== undefined)
      userUpdates.displayName = data.displayName
    if (data.birthDate) {
      // Parse as UTC midnight to avoid TZ ambiguity (validated as YYYY-MM-DD)
      const bd = new Date(`${data.birthDate}T00:00:00.000Z`)
      const kin = calculateKinMaya(bd)
      userUpdates.birthDate = bd
      userUpdates.astrologicalSign = calculateZodiacSign(bd)
      if (kin !== null) userUpdates.mayanKin = kin.toString()
    } else if (data.birthDate === "") {
      userUpdates.birthDate = null
      userUpdates.astrologicalSign = null
      userUpdates.mayanKin = null
      userUpdates.personalArcana = null
    }
    // Invalidate personalArcana when displayName changes and birthDate exists
    if (data.displayName !== undefined && data.displayName !== null) {
      const currentUser = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { birthDate: true },
      })
      if (currentUser?.birthDate) userUpdates.personalArcana = null
    }
    const profileUpdates: Partial<Prisma.UserProfileUncheckedCreateInput> = {}
    if (data.bio !== undefined) profileUpdates.bio = data.bio || null
    if (data.location !== undefined)
      profileUpdates.location = data.location || null
    if (data.website !== undefined)
      profileUpdates.website = data.website || null
    if (data.username !== undefined)
      profileUpdates.username = data.username || null
    if (data.birthPlace !== undefined)
      profileUpdates.birthPlace = data.birthPlace || null

    const hasUserUpdates = Object.keys(userUpdates).length > 0
    const hasProfileUpdates = Object.keys(profileUpdates).length > 0

    if (hasUserUpdates || hasProfileUpdates) {
      await prisma.$transaction(async (tx) => {
        if (hasUserUpdates) {
          if (data.birthDate) {
            // Parse as UTC midnight to avoid TZ ambiguity (validated as YYYY-MM-DD)
            const bd = new Date(`${data.birthDate}T00:00:00.000Z`)
            const currentUser = await tx.user.findUnique({
              where: { id: auth.userId },
              select: { name: true },
            })
            if (currentUser) {
              const computed = calculatePersonalArcana(bd, currentUser.name)
              // Sem nome nao ha arcano: anula em vez de preservar valor velho,
              // para a proxima leitura recalcular do zero.
              userUpdates.personalArcana =
                computed !== null && Number.isInteger(computed)
                  ? computed
                  : null
            }
          }
          await tx.user.update({
            where: { id: auth.userId },
            data: userUpdates,
          })
        }
        if (hasProfileUpdates) {
          await tx.userProfile.upsert({
            where: { userId: auth.userId },
            create: { ...profileUpdates, userId: auth.userId },
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
