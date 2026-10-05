import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { enforceSocialLimit } from "@/lib/middleware/rate-limit"
import { enforceCsrf } from "@/lib/middleware/csrf"
import { prisma } from "@/lib/prisma"
import { canFollow } from "@/lib/social/privacy"
import { readFollowCounts } from "@/lib/social/follow-lists"
import { earnVersos, VersosSource } from "@/lib/social/versos"
import { parsePrivacy } from "@/lib/validators/profile"
import { trackFollow, trackVersosEarned } from "@/lib/analytics"
import { Prisma } from "@prisma/client"

import { emitFollowUpdate, emitNotification } from "@socket/src/emitters"

export const dynamic = "force-dynamic"

/**
 * Toggle de follow (T043/SC35): UM endpoint POST que
 * segue (201) ou deixa de seguir (200) — sem DELETE separado.
 * Idempotente: P2002 (create race) → 201 following:true; P2025 (delete race) → 200 following:false.
 * maxFollowing checado sob lock FOR UPDATE dentro da transação; earnVersos + contagens são best-effort.
 * Contagens do response: sempre escopadas no ALVO (SC39 subject change).
 * SC38: omitir contadores quando target.statsVisibility === "private".
 * Notificação: dedupe do par antes de criar (anti-flood) + limpeza no unfollow.
 * TOCTOU: revalida alvo dentro da tx (isBanned/deletedAt/isActive).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const reqId = newReqId()

  // Proteção CSRF para endpoint POST que altera estado
  const csrfError = enforceCsrf(request, reqId)
  if (csrfError) return csrfError

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const { userId: targetId } = await params

  const rate = await enforceSocialLimit({
    limit: "follow",
    userId: auth.userId,
    reqId,
  })
  if (!rate.allowed) return rate.response

  if (targetId === auth.userId) {
    return apiError(
      "CANNOT_FOLLOW_SELF",
      "Nao e possivel seguir a si mesmo",
      reqId,
      409,
      { reason: "self_follow" },
      rate.headers,
    )
  }

  // Variáveis de resultado (escopo compartilhado entre try e catch para
  // os race handlers re-lerem a fonte de verdade)
  let following = false
  let followingCount = 0
  let followersCount = 0
  let statsPrivate = false
  // Notificação capturada da row criada na tx (id/type/message/data) para
  // o emit pós-commit — o payload sai da PRÓPRIA row (revisão V5), sem
  // re-derivar type/data. (`as union` para o CFA não estreitar a leitura
  // a `null`.)
  let createdNotification = null as {
    id: string
    type: string
    message: string
    data: unknown
  } | null

  // Envelope único do contrato 201/200 (SC38 + subject dos counts num só lugar)
  const respond = () =>
    Response.json(
      {
        data: {
          following,
          ...(statsPrivate ? {} : { followingCount, followersCount }),
        },
      },
      { status: following ? 201 : 200, headers: rate.headers },
    )
  const internal = () =>
    apiError(
      "INTERNAL_ERROR",
      "Erro interno",
      reqId,
      500,
      undefined,
      rate.headers,
    )

  try {
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, isBanned: true, deletedAt: true },
    })
    if (!target || target.isBanned || target.deletedAt) {
      return apiError(
        "USER_NOT_FOUND",
        "Usuario nao encontrado",
        reqId,
        404,
        undefined,
        rate.headers,
      )
    }

    const viewer = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { displayName: true, name: true, maxFollowing: true },
    })
    if (!viewer) {
      return apiError(
        "AUTH_TOKEN_INVALID",
        "Sessao invalida",
        reqId,
        401,
        undefined,
        rate.headers,
      )
    }

    // Privacidade do alvo UMA vez: gate do response SC38 + preloaded do canFollow
    const targetProfile = await prisma.userProfile.findUnique({
      where: { userId: targetId },
      select: { privacy: true },
    })
    const targetPrivacy = parsePrivacy(targetProfile?.privacy)
    statsPrivate = !targetPrivacy || targetPrivacy.statsVisibility === "private"

    // Direcao decide ANTES do gate de privacidade: unfollow/revogacao
    // nunca e bloqueado por whoCanFollow do alvo (revisao I1 — sem isso
    // um alvo que vira "nobody" impedia o seguidor de sair).
    const existingLink = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: auth.userId,
          followingId: targetId,
        },
      },
      select: { id: true },
    })
    if (!existingLink) {
      const decision = await canFollow(
        { id: auth.userId },
        { id: targetId },
        targetProfile,
      )
      if (!decision.allowed) {
        return apiError(
          "FOLLOW_NOT_ALLOWED",
          "Este usuario nao permite novos seguidores",
          reqId,
          403,
          { reason: decision.reason },
          rate.headers,
        )
      }
    }

    let earnedAmount: number | null = null

    await prisma.$transaction(async (tx) => {
      const existing = await tx.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: auth.userId,
            followingId: targetId,
          },
        },
      })

      if (existing) {
        // Unfollow path — remove também a notificação do par (anti-flood)
        await tx.follow.delete({
          where: {
            followerId_followingId: {
              followerId: auth.userId,
              followingId: targetId,
            },
          },
        })
        await tx.notification.deleteMany({
          where: {
            userId: targetId,
            type: "follow",
            data: { equals: { followerId: auth.userId } },
          },
        })
        following = false
      } else {
        // TOCTOU: revalida o alvo dentro da tx
        const freshTarget = await tx.user.findUnique({
          where: { id: targetId },
          select: { isBanned: true, deletedAt: true, isActive: true },
        })
        if (
          !freshTarget ||
          freshTarget.isBanned ||
          freshTarget.deletedAt ||
          freshTarget.isActive === false
        ) {
          throw new TargetUnavailableError()
        }
        // Serializa toggles concorrentes do MESMO follower: lock FOR UPDATE
        const locked = await tx.$queryRaw<
          { maxFollowing: number }[]
        >`SELECT "maxFollowing" FROM "User" WHERE id = ${auth.userId} FOR UPDATE`
        const maxFollowing = locked[0]?.maxFollowing ?? viewer.maxFollowing
        const currentFollowing = await tx.follow.count({
          where: {
            followerId: auth.userId,
            following: { isActive: true, isBanned: false, deletedAt: null },
          },
        })
        if (currentFollowing >= maxFollowing) {
          throw new MaxFollowingError(maxFollowing)
        }
        // Verifica se já existe marker de recompensa para este par
        const existingReward = await tx.followReward.findUnique({
          where: {
            followerId_followingId: {
              followerId: auth.userId,
              followingId: targetId,
            },
          },
        })
        const shouldReward = !existingReward
        await tx.follow.create({
          data: { followerId: auth.userId, followingId: targetId },
        })
        // Notificação: dedupe do par ANTES de criar (anti-flood)
        await tx.notification.deleteMany({
          where: {
            userId: targetId,
            type: "follow",
            data: { equals: { followerId: auth.userId } },
          },
        })
        const followerName = viewer.displayName ?? viewer.name
        const message = `${followerName} começou a seguir você`
        const row = await tx.notification.create({
          data: {
            userId: targetId,
            type: "follow",
            message,
            data: { followerId: auth.userId },
          },
        })
        createdNotification = {
          id: row.id,
          type: row.type,
          message: row.message,
          data: row.data,
        }
        // Cria marker de recompensa se for o primeiro follow deste par
        if (shouldReward) {
          await tx.followReward.create({
            data: { followerId: auth.userId, followingId: targetId },
          })
          // earnVersos no mesmo tx (atomicidade total) — null = sem
          // UserProfile: aborta para marker nunca existir sem pagamento
          const earned = await earnVersos(auth.userId, VersosSource.Follow, tx)
          if (earned === null) {
            logger.error(
              { reqId, userId: auth.userId },
              "[follow] earnVersos sem UserProfile — abortando tx",
            )
            throw new Error("follow reward requires UserProfile")
          }
          earnedAmount = earned
        }
        following = true
      }

      // Contagens dentro da transacao, escopadas no ALVO (SC39 subject change)
      const counts = await readFollowCounts(tx, targetId, targetId)
      followingCount = counts.followingCount
      followersCount = counts.followersCount
    })

    logger.info(
      { reqId, userId: auth.userId, targetId, following },
      "[follow] toggle",
    )

    // Analytics (T136 no-op server-side até deploy)
    if (following) {
      trackFollow(targetId)
    }
    if (earnedAmount !== null) {
      trackVersosEarned(VersosSource.Follow, earnedAmount)
    }

    // Realtime (T070/T088 parcial): room do alvo. Fire-and-forget
    // (publishRealtime engole falhas de bus) — o 201/200 não espera
    // o publish (revisão Phase 2.5, Crítico 6).
    void emitFollowUpdate({
      followerId: auth.userId,
      followingId: targetId,
      isFollowing: following,
    })
    if (following && createdNotification !== null) {
      void emitNotification({
        userId: targetId,
        notification: {
          id: createdNotification.id,
          type: createdNotification.type,
          message: createdNotification.message,
          data: createdNotification.data,
        },
      })
    }

    return respond()
  } catch (error) {
    // try/catch do handler: qualquer throw AQUI dentro (ex.: re-query de
    // corrida falhar) não pode escapar do POST como 500 sem JSON
    try {
      if (error instanceof MaxFollowingError) {
        return apiError(
          "MAX_FOLLOWING_REACHED",
          "Limite de seguindo atingido",
          reqId,
          409,
          { max: error.maxFollowing },
          rate.headers,
        )
      }
      if (error instanceof TargetUnavailableError) {
        return apiError(
          "USER_NOT_FOUND",
          "Usuario nao encontrado",
          reqId,
          404,
          undefined,
          rate.headers,
        )
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2025")
      ) {
        // A tx rollbackou — NAO inferir qual constraint falhou (pode ser
        // follow, followReward ou qualquer unique futuro): re-ler a fonte
        // de verdade e responder conforme o estado real do banco.
        const link = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: auth.userId,
              followingId: targetId,
            },
          },
          select: { id: true },
        })
        following = link != null
        const counts = await readFollowCounts(prisma, targetId, targetId)
        followingCount = counts.followingCount
        followersCount = counts.followersCount
        logger.info(
          { reqId, userId: auth.userId, targetId, code: error.code, following },
          "[follow] corrida resolvida pela fonte de verdade",
        )
        // A tx abortou (notificação não persistida) — emite só o estado
        // real do vínculo; a requisição vencedora cuida da notification.
        void emitFollowUpdate({
          followerId: auth.userId,
          followingId: targetId,
          isFollowing: following,
        })
        return respond()
      }
      logger.error({ err: error, reqId }, "[follow] erro interno")
      return internal()
    } catch (handlerError) {
      logger.error(
        { err: handlerError, reqId },
        "[follow] falha no handler de erro de corrida",
      )
      return internal()
    }
  }
}

class MaxFollowingError extends Error {
  readonly maxFollowing: number
  constructor(maxFollowing: number) {
    super("max following reached")
    this.name = "MaxFollowingError"
    this.maxFollowing = maxFollowing
  }
}

class TargetUnavailableError extends Error {
  constructor() {
    super("target became unavailable")
    this.name = "TargetUnavailableError"
  }
}
