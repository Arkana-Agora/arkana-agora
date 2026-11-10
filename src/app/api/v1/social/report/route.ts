import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { newReqId, logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { enforceCsrf } from "@/lib/middleware/csrf"
import { checkSocialLimit } from "@/lib/social/limits"
import { REMOVED_COMMENT_CONTENT } from "@/lib/social/comments"
import { Prisma } from "@prisma/client"

const reportSchema = z.object({
  targetType: z.enum(["post", "comment", "user"]),
  targetId: z.string().cuid(),
  reason: z.string().min(1).max(500),
})

async function validateTargetExists(
  targetType: string,
  targetId: string,
  reporterId: string,
): Promise<{ exists: boolean; authorId?: string }> {
  switch (targetType) {
    case "post": {
      const post = await prisma.post.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          authorId: true,
          audience: true,
          isHidden: true,
          author: {
            select: {
              isBanned: true,
              deletedAt: true,
              isActive: true,
              profile: { select: { privacy: true } },
            },
          },
        },
      })
      if (
        !post ||
        post.isHidden ||
        post.author.isBanned ||
        post.author.deletedAt ||
        !post.author.isActive
      ) {
        return { exists: false }
      }
      // Check visibility for followers-only posts
      if (post.audience === "followers") {
        const follow = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: reporterId,
              followingId: post.authorId,
            },
          },
        })
        if (!follow && post.authorId !== reporterId) {
          return { exists: false }
        }
      }
      return { exists: true, authorId: post.authorId }
    }
    case "comment": {
      const comment = await prisma.comment.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          authorId: true,
          content: true,
          post: {
            select: {
              authorId: true,
              audience: true,
              isHidden: true,
              author: {
                select: {
                  isBanned: true,
                  deletedAt: true,
                  isActive: true,
                  profile: { select: { privacy: true } },
                },
              },
            },
          },
        },
      })
      if (
        !comment ||
        comment.content === REMOVED_COMMENT_CONTENT ||
        comment.post.isHidden ||
        comment.post.author.isBanned ||
        comment.post.author.deletedAt ||
        !comment.post.author.isActive
      ) {
        return { exists: false }
      }
      // Check visibility for followers-only posts
      if (comment.post.audience === "followers") {
        const follow = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: reporterId,
              followingId: comment.post.authorId,
            },
          },
        })
        if (!follow && comment.post.authorId !== reporterId) {
          return { exists: false }
        }
      }
      return { exists: true, authorId: comment.authorId }
    }
    case "user": {
      const user = await prisma.user.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          isBanned: true,
          deletedAt: true,
          isActive: true,
          profile: { select: { privacy: true } },
        },
      })
      if (!user || !user.isActive || user.isBanned || user.deletedAt) {
        return { exists: false }
      }
      // Check privacy settings
      const profile = user.profile as {
        privacy?: { profileVisibility?: string }
      } | null
      if (profile && profile.privacy?.profileVisibility === "private") {
        return { exists: false }
      }
      return { exists: true, authorId: user.id }
    }
    default:
      return { exists: false }
  }
}

export async function POST(request: Request) {
  const reqId = newReqId()

  // Canonical order: CSRF → auth → Zod → rate → lookup → tx → emit
  const csrfError = enforceCsrf(request, reqId)
  if (csrfError) return csrfError

  const authResult = await requireAuth(request, reqId)
  if (authResult instanceof Response) {
    return authResult
  }
  const reporterId = authResult.userId

  // Rate limiting
  const rateLimitResult = await checkSocialLimit("report", reporterId)
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Limite de reports excedido",
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000),
          ),
        },
      },
    )
  }

  try {
    const body = await request.json()
    const parsed = reportSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Dados invalidos",
        reqId,
        422,
        parsed.error.errors.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      )
    }

    const { targetType, targetId, reason } = parsed.data

    // Validate target exists and is reportable
    const targetValidation = await validateTargetExists(
      targetType,
      targetId,
      reporterId,
    )
    if (!targetValidation.exists) {
      return apiError("NOT_FOUND", "Conteúdo não encontrado", reqId, 404)
    }

    // Prevent self-reporting
    if (targetValidation.authorId === reporterId) {
      return apiError(
        "FORBIDDEN",
        "Não é possível reportar seu próprio conteúdo",
        reqId,
        403,
      )
    }

    // Create report - rely on unique constraint for duplicate detection
    let report
    try {
      report = await prisma.contentReport.create({
        data: {
          reporterId,
          targetType,
          targetId,
          reason,
          status: "PENDING",
        },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return apiError(
          "CONFLICT",
          "Você já reportou este conteúdo",
          reqId,
          409,
        )
      }
      throw error
    }

    logger.info(
      { reqId, reporterId, targetType, targetId, reportId: report.id },
      "[POST /api/v1/social/report] report created",
    )

    return NextResponse.json({ data: { id: report.id } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error(
      { reqId, error: message },
      "[POST /api/v1/social/report] error",
    )
    return apiError("INTERNAL_ERROR", "Erro interno do servidor", reqId, 500)
  }
}
