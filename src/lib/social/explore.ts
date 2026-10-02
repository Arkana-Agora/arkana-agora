import type { UserRole } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  hasPrivateProfile,
  POST_INCLUDE,
  type FeedPost,
} from "@/lib/social/feed-algorithm"

/**
 * Consultas do Explore (T053–T055, US-022). Padrão `follow-lists.ts`:
 * queries ficam na lib (testáveis) e as rotas só validam/envelopam.
 *
 * Decisões do dono (2026-09-30):
 * - Janela do trending/hashtags = 7 dias; score = `likeCount +
 *   commentCount×2` desc; limites fixos (trending 20, hashtags 10,
 *   sugestões 10).
 * - Autores com `profileVisibility: "private"` são EXCLUÍDOS de todo o
 *   Explore (`docs/06-features/profile.md`: o usuário controla se aparece
 *   na página Explorar; fail-closed — S2-15 não enumerava Explorar).
 * - Sugestões: profissionais (`UserRole.PROFESSIONAL`) primeiro, depois
 *   `followersCount` desc ("perfis populares, profissionais" — sprint-2
 *   task 31).
 */

export const TRENDING_LIMIT = 20
export const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
/**
 * Pré-seleção ordenada por likeCount antes do rank exato em memória —
 * `engagementScore` não é expressão ordenável no Prisma; janela de 7 dias
 * com cap de 100 candidatos é a aproximação documentada (mesma classe de
 * aproximação do keyset do feed).
 */
export const TRENDING_CANDIDATE_CAP = 100
export const HASHTAG_LIMIT = 10
export const SUGGESTIONS_LIMIT = 10
export const SUGGESTIONS_CANDIDATE_CAP = 200

function engagementScore(post: {
  likeCount: number
  commentCount: number
}): number {
  return post.likeCount + post.commentCount * 2
}

/** T053: posts públicos da última semana por engagementScore (autor ativo). */
export async function getTrendingPosts(): Promise<FeedPost[]> {
  const since = new Date(Date.now() - TRENDING_WINDOW_MS)

  const candidates = await prisma.post.findMany({
    where: {
      audience: "public",
      isHidden: false,
      author: { isBanned: false, deletedAt: null, isActive: true },
      createdAt: { gte: since },
    },
    orderBy: [
      { likeCount: "desc" },
      { commentCount: "desc" },
      { createdAt: "desc" },
    ],
    take: TRENDING_CANDIDATE_CAP,
    include: POST_INCLUDE,
  })

  return candidates
    .filter((post) => !hasPrivateProfile(post.author))
    .sort(
      (a, b) =>
        engagementScore(b) - engagementScore(a) ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id),
    )
    .slice(0, TRENDING_LIMIT)
}

export interface TrendingHashtag {
  tag: string
  count: number
}

interface HashtagRow {
  tag: string
  post: {
    author: { profile: { privacy?: unknown } | null }
  }
}

/**
 * Agrega linhas `PostHashtag` em top-N por contagem (desempate alfabético),
 * descartando tags de autores com perfil `private` — usado pelo trending
 * (T054) e pela busca unificada (T056).
 */
export function rankHashtags(
  rows: readonly HashtagRow[],
  limit: number,
): TrendingHashtag[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (hasPrivateProfile(row.post.author)) continue
    counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit)
}

/** T054: top 10 hashtags da semana (públicos, autor ativo, sem private). */
export async function getTrendingHashtags(): Promise<TrendingHashtag[]> {
  const since = new Date(Date.now() - TRENDING_WINDOW_MS)

  const rows = await prisma.postHashtag.findMany({
    where: {
      post: {
        audience: "public",
        isHidden: false,
        createdAt: { gte: since },
        author: { isBanned: false, deletedAt: null, isActive: true },
      },
    },
    // headroom: `rankHashtags` descarta autores com perfil `private` e
    // NÃO repõe — 10× o top10 evita varrer a semana inteira
    take: HASHTAG_LIMIT * 10,
    select: {
      tag: true,
      post: {
        select: {
          author: { select: { profile: { select: { privacy: true } } } },
        },
      },
    },
  })

  return rankHashtags(rows, HASHTAG_LIMIT)
}

export interface ExploreSuggestion {
  id: string
  name: string
  username: string | null
  avatar: string | null
  role: UserRole
  followersCount: number
}

/**
 * T055: sugestões de quem seguir — exclui self + já-seguidos + banidos +
 * soft-deleted + inativos + perfil private; ordem profissionais →
 * followersCount desc → createdAt desc; `followersCount` vem do `_count`
 * (a privacy é lida só para filtrar e NUNCA sai na resposta).
 */
export async function getExploreSuggestions(
  viewerId: string,
): Promise<ExploreSuggestion[]> {
  const following = await prisma.follow.findMany({
    where: { followerId: viewerId },
    select: { followingId: true },
  })

  const candidates = await prisma.user.findMany({
    where: {
      id: { not: viewerId, notIn: following.map((f) => f.followingId) },
      isBanned: false,
      deletedAt: null,
      isActive: true,
    },
    orderBy: [{ followers: { _count: "desc" } }, { createdAt: "desc" }],
    take: SUGGESTIONS_CANDIDATE_CAP,
    select: {
      id: true,
      name: true,
      displayName: true,
      avatar: true,
      role: true,
      createdAt: true,
      profile: { select: { username: true, privacy: true } },
      _count: { select: { followers: true } },
    },
  })

  return candidates
    .filter((user) => !hasPrivateProfile(user))
    .sort((a, b) => {
      const aPro = a.role === "PROFESSIONAL" ? 1 : 0
      const bPro = b.role === "PROFESSIONAL" ? 1 : 0
      if (aPro !== bPro) return bPro - aPro
      const followersDiff = b._count.followers - a._count.followers
      if (followersDiff !== 0) return followersDiff
      return b.createdAt.getTime() - a.createdAt.getTime()
    })
    .slice(0, SUGGESTIONS_LIMIT)
    .map((user) => ({
      id: user.id,
      name: user.displayName ?? user.name,
      username: user.profile?.username ?? null,
      avatar: user.avatar,
      role: user.role,
      followersCount: user._count.followers,
    }))
}
