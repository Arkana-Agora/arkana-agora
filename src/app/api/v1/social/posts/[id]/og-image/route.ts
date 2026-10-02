import { optionalAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { generatePostOgImage } from "@/lib/og-image"
import { prisma } from "@/lib/prisma"
import {
  canViewPost,
  postIsGated,
  POST_DETAIL_AUTHOR_SELECT,
} from "@/lib/social/post-visibility"

export const dynamic = "force-dynamic"

// Erros (404 uniforme anti-timing, 500) e resposta gated nunca são
// cacheáveis por compartilhado; `Vary` acompanha o `private` por
// consistência com o detalhe do post (S2-18).
const OG_ERROR_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
} satisfies HeadersInit

/**
 * GET /api/v1/social/posts/:id/og-image (T058/US-021): PNG 1200×630 via
 * `generatePostOgImage` (T029).
 *
 * Autenticação **opcional** (mesmo padrão da OG image de readings):
 * crawlers de preview chegam sem token, então o post público é servido a
 * anônimos. Visibilidade idêntica ao detalhe (T057/CHK006) via
 * `canViewPost` — gated (`followers`/perfil `private`) exige follow:
 * anônimo ou não seguidor → **404 `POST_NOT_FOUND` uniforme**
 * (CHK005: a OG image de conteúdo restrito não é buscável por terceiros).
 *
 * Cache (T050): público → `public, max-age=3600, s-maxage=86400` sem
 * `Vary` (idêntico para todos); gated → `private, no-store`; erros 404/500
 * → `private, no-store` + `Vary: Authorization` (nunca cacheável).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const reqId = newReqId()

  const { id } = await params

  try {
    // opcional: crawlers chegam sem token; erro aqui cai no catch 500
    const viewerId = await optionalAuth(request)

    const post = await prisma.post.findUnique({
      where: { id },
      include: { author: { select: POST_DETAIL_AUTHOR_SELECT } },
    })

    if (!post || !(await canViewPost(post, viewerId))) {
      return apiError(
        "POST_NOT_FOUND",
        "Publicacao nao encontrada",
        reqId,
        404,
        undefined,
        OG_ERROR_HEADERS,
      )
    }

    const png = await generatePostOgImage({
      content: post.content,
      authorName: post.author.displayName ?? post.author.name,
      type: post.type,
    })

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(png.length),
        // Público não leva `Vary: Authorization`: a resposta é idêntica
        // com ou sem token e o Vary só fragmentaria o cache do CDN por
        // sessão (review). Gated sai private,no-store (sem utilidade de
        // Vary também).
        "Cache-Control": postIsGated(post)
          ? "private, no-store"
          : "public, max-age=3600, s-maxage=86400",
      },
    })
  } catch (error) {
    logger.error({ err: error, reqId }, "[posts/og-image] erro ao gerar")
    return apiError(
      "INTERNAL_ERROR",
      "Erro interno",
      reqId,
      500,
      undefined,
      OG_ERROR_HEADERS,
    )
  }
}
