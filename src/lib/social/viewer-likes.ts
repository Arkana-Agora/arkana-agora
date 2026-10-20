import { prisma } from "@/lib/prisma"

/**
 * Revlsao R6: `liked` nunca foi derivado do servidor — o client partia de
 * `false` e s� sabia do like ap�s um toggle (a resposta do POST). Os dois
 * helpers abaixo resolvem isso com UMA query por lote, limitada aos ids j�
 * carregados (feed: `postId IN`; coment�rios: `commentId IN`).
 *
 * Fora de cache: o feed materializado n�o embute `viewerHasLiked` (ele fica
 * stale a cada like) — o enriquecimento acontece a cada request, por isso o
 * campo � sempre a verdade atual do viewer.
 */

/** Ids dos `postIds` que o viewer j� curtiu. */
export async function viewerLikedPostIds(
  viewerId: string,
  postIds: string[],
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set()
  const rows = await prisma.postLike.findMany({
    where: { userId: viewerId, postId: { in: postIds } },
    select: { postId: true },
  })
  return new Set(rows.map((row) => row.postId))
}

/** Ids dos `commentIds` que o viewer j� curtiu. */
export async function viewerLikedCommentIds(
  viewerId: string,
  commentIds: string[],
): Promise<Set<string>> {
  if (commentIds.length === 0) return new Set()
  const rows = await prisma.commentLike.findMany({
    where: { userId: viewerId, commentId: { in: commentIds } },
    select: { commentId: true },
  })
  return new Set(rows.map((row) => row.commentId))
}
