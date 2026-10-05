import type { Prisma } from "@prisma/client"

import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import {
  canViewPost,
  POST_DETAIL_AUTHOR_SELECT,
  toPublicPost,
} from "@/lib/social/post-visibility"

export const dynamic = "force-dynamic"

// Detalhe é privado por natureza (post pode ser gated) — mesmos headers do
// feed (S2-18): nunca cacheável por CDN sem `Vary: Authorization`.
const DETAIL_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
} satisfies Record<string, string>

const COMMENT_AUTHOR_SELECT = {
  id: true,
  name: true,
  displayName: true,
  avatar: true,
} satisfies Prisma.UserSelect

// Preview embutido do detalhe: lote 10 (mesmo default do endpoint
// dedicado de comentários, T078/RF-SOC-005), mais recentes primeiro,
// aninhamento de 1 nível (SC11 — respostas diretas só).
const COMMENTS_PREVIEW_LIMIT = 10
const REPLIES_PREVIEW_LIMIT = 10

/**
 * GET /api/v1/social/posts/:id (T057/US-021): post + comentários nested
 * 1 nível (raízes com `replies`).
 *
 * Visibilidade (S2-15/Q28) via `canViewPost` — o MESMO predicado do
 * og-image (T058): inexistente, `isHidden`, autor banido/soft-deleted/
 * inativo, `audience='followers'` sem follow ou perfil `private` sem
 * follow → **404 `POST_NOT_FOUND` uniforme** (anti-timing; nunca revela
 * qual dos casos); o autor vê o próprio post (exceto oculto/banido — ver
 * `canViewPost`).
 *
 * Resposta: `{ data: { post, comments } }` (o `comments` sai de dentro do
 * post para não duplicar o payload). Autores de comentários banidos/
 * soft-deleted são filtrados (mesma regra LGPD do predicado do post).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const { id } = await params

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: POST_DETAIL_AUTHOR_SELECT },
        comments: {
          where: {
            parentCommentId: null,
            // Revisão R: mesma regra LGPD do predicado do post — autores
            // inativos (deactivated) também não aparecem
            author: { isActive: true, isBanned: false, deletedAt: null },
          },
          orderBy: { createdAt: "desc" },
          take: COMMENTS_PREVIEW_LIMIT,
          include: {
            author: { select: COMMENT_AUTHOR_SELECT },
            replies: {
              where: {
                author: { isActive: true, isBanned: false, deletedAt: null },
              },
              orderBy: { createdAt: "desc" },
              take: REPLIES_PREVIEW_LIMIT,
              include: { author: { select: COMMENT_AUTHOR_SELECT } },
            },
          },
        },
      },
    })

    if (!post || !(await canViewPost(post, auth.userId))) {
      return apiError(
        "POST_NOT_FOUND",
        "Publicacao nao encontrada",
        reqId,
        404,
        undefined,
        DETAIL_HEADERS,
      )
    }

    const { comments, ...postFields } = post
    return Response.json(
      { data: { post: toPublicPost(postFields), comments } },
      { headers: DETAIL_HEADERS },
    )
  } catch (error) {
    logger.error({ err: error, reqId }, "[posts/[id]] erro no detalhe")
    return apiError(
      "INTERNAL_ERROR",
      "Erro interno",
      reqId,
      500,
      undefined,
      DETAIL_HEADERS,
    )
  }
}
