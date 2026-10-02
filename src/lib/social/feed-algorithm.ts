import type { Prisma } from "@prisma/client"

import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { parsePrivacy } from "@/lib/validators/profile"

/**
 * Feed algorithm (T026/US-022): candidatos visíveis (S2-15) de
 * `followingIds`, ordenação S2-5 em 4 níveis, cursor `(createdAt, id)`,
 * fallback explore se 0 following (ramo `followers` vaza vazio).
 *
 * Invariante de paginação: a janela de candidatos é exatamente a página
 * (`take = pageSize`) — todo post visível da janela é exibido, logo o
 * cursor (menor `(createdAt, id)` exibido) não repete nem pula conteúdo
 * visível. Pinned adiados pelo cap (tier 1) viajam no cursor (`include`)
 * e são servidos na página seguinte mesmo sendo mais novos que o cursor.
 */

export const FEED_DEFAULT_LIMIT = 10
export const FEED_MAX_LIMIT = 50

const ENGAGEMENT_WINDOW_MS = 2 * 60 * 60 * 1000 // tier 2: últimas 2h
const MAX_CURSOR_INCLUDE = 50 // teto defensivo p/ ids de cursor adulterado

export interface FeedCursor {
  createdAt: number
  id: string
  /** posts adiados (cap de pinned) a servir na próxima página */
  include?: string[]
}

export function encodeFeedCursor(cursor: FeedCursor): string {
  const payload =
    cursor.include && cursor.include.length > 0
      ? { ...cursor, include: cursor.include.slice(0, MAX_CURSOR_INCLUDE) }
      : { createdAt: cursor.createdAt, id: cursor.id }
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

const MAX_DATE_MS = 8.64e15 // limite técnico de Date (JS)

export function decodeFeedCursor(raw: string): FeedCursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as Partial<FeedCursor>
    if (
      typeof parsed.createdAt !== "number" ||
      !Number.isFinite(parsed.createdAt) ||
      parsed.createdAt < 0 ||
      parsed.createdAt > MAX_DATE_MS ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0
    ) {
      return null
    }
    const include =
      Array.isArray(parsed.include) &&
      parsed.include.every((id) => typeof id === "string" && id.length > 0)
        ? parsed.include.slice(0, MAX_CURSOR_INCLUDE)
        : undefined
    return {
      createdAt: parsed.createdAt,
      id: parsed.id,
      ...(include && include.length > 0 ? { include } : {}),
    }
  } catch {
    return null
  }
}

export interface RankablePost {
  id: string
  authorId: string
  createdAt: Date
  isPinned: boolean
}

export interface RankContext {
  /** likes + comments×2 nas últimas 2h (tier 2) */
  engagementByPost: ReadonlyMap<string, number>
  /** interação prévia do viewer via PostLike/Comment (tier 4) */
  interactedPostIds: ReadonlySet<string>
}

export function rankFeedPosts<T extends RankablePost>(
  posts: readonly T[],
  ctx: RankContext,
): T[] {
  return [...posts].sort((a, b) => {
    // tier 1: isPinned
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    // tier 2: engajamento das últimas 2h
    const engagement =
      (ctx.engagementByPost.get(b.id) ?? 0) -
      (ctx.engagementByPost.get(a.id) ?? 0)
    if (engagement !== 0) return engagement
    // tier 3: createdAt desc
    const timeDiff = b.createdAt.getTime() - a.createdAt.getTime()
    if (timeDiff !== 0) return timeDiff
    // tier 4: desempate por interação prévia do viewer
    const aInteracted = ctx.interactedPostIds.has(a.id)
    const bInteracted = ctx.interactedPostIds.has(b.id)
    if (aInteracted !== bInteracted) return aInteracted ? -1 : 1
    return b.id.localeCompare(a.id)
  })
}

/**
 * Tier 1 (S2-5): no máximo 1 post fixado por página de `limit`.
 * Posts fora da página (pinned #2+ ou overflow) saem em `dropped` e o
 * caller os reagenda no cursor — nada é descartado silenciosamente.
 */
export function applyPinnedCap<T extends RankablePost>(
  posts: readonly T[],
  limit: number,
): { page: T[]; dropped: T[] } {
  const page: T[] = []
  const dropped: T[] = []
  let pinnedUsed = 0
  for (const post of posts) {
    if (page.length >= limit) {
      dropped.push(post)
      continue
    }
    if (post.isPinned) {
      if (pinnedUsed === 0) {
        page.push(post)
        pinnedUsed += 1
      } else {
        dropped.push(post)
      }
    } else {
      page.push(post)
    }
  }
  return { page, dropped }
}

const AUTHOR_SELECT = {
  id: true,
  name: true,
  displayName: true,
  avatar: true,
  profile: { select: { privacy: true } },
} satisfies Prisma.UserSelect

/** Include canônico de um Post + autor (usado pelo feed e pelo Explore). */
export const POST_INCLUDE = {
  author: { select: AUTHOR_SELECT },
} satisfies Prisma.PostInclude

export type FeedPost = Prisma.PostGetPayload<{
  include: typeof POST_INCLUDE
}>

export interface FeedPage {
  posts: FeedPost[]
  nextCursor: string | null
}

/**
 * S2-15 (predicado único de privacidade de perfil, compartilhado por feed e
 * Explore): `UserProfile.privacy.profileVisibility === "private"` → só
 * seguidores/quem segue o autor. O contrato de armazenamento é MINUSCULO
 * (privacySchema z.enum) — o check antigo ("PRIVATE") nunca casava no banco
 * e vazava post de perfil privado (S2-15).
 *
 * Fail-closed (review Phase 2): privacy malformada (JSON inválido, enum
 * legado etc.) é tratada como **privada** — mesmo risco do bug original.
 * Sem privacy gravada (coluna nula) continua pública (default).
 */
export function hasPrivateProfile(source: {
  profile: { privacy?: unknown } | null
}): boolean {
  const raw = source.profile?.privacy
  if (raw === null || raw === undefined) return false
  const parsed = parsePrivacy(raw)
  if (parsed === null) {
    logger.warn(
      "[feed-algorithm] privacy malformada — tratada como privada (fail-closed)",
    )
    return true
  }
  return parsed.profileVisibility === "private"
}

function minTuple(posts: readonly FeedPost[]): FeedCursor | undefined {
  let min: FeedCursor | undefined
  for (const post of posts) {
    const cursor: FeedCursor = {
      createdAt: post.createdAt.getTime(),
      id: post.id,
    }
    if (
      !min ||
      cursor.createdAt < min.createdAt ||
      (cursor.createdAt === min.createdAt && cursor.id < min.id)
    ) {
      min = cursor
    }
  }
  return min
}

function olderCursor(a: FeedCursor, b: FeedCursor): FeedCursor {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? a : b
  return a.id < b.id ? a : b
}

export async function getFeed(
  userId: string,
  cursor?: string,
  limit = FEED_DEFAULT_LIMIT,
): Promise<FeedPage> {
  const pageSize = Math.min(Math.max(limit, 1), FEED_MAX_LIMIT)
  // janela exata = página: todo candidato visível lido é exibido, então o
  // cursor nunca pula conteúdo visível (nem repete — keyset estrito)
  const take = pageSize

  const followingIds = (
    await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    })
  ).map((follow) => follow.followingId)

  const parsed = cursor ? decodeFeedCursor(cursor) : null
  if (cursor && !parsed) {
    // cursor inválido → contrato explícito: página vazia sem próximo cursor
    // (nunca reinicia no topo, o que duplicaria conteúdo em loop)
    return { posts: [], nextCursor: null }
  }

  const keyset: Prisma.PostWhereInput[] = []
  if (parsed) {
    keyset.push(
      { createdAt: { lt: new Date(parsed.createdAt) } },
      { createdAt: new Date(parsed.createdAt), id: { lt: parsed.id } },
    )
    if (parsed.include && parsed.include.length > 0) {
      keyset.push({ id: { in: parsed.include } })
    }
  }

  const where: Prisma.PostWhereInput = {
    isHidden: false,
    // review: posts de autores banidos, inativos ou em janela LGPD de
    // soft-delete não podem aparecer (mesma regra do guard requireAuth)
    author: { isBanned: false, deletedAt: null, isActive: true },
    // visibilidade S2-15: público de qualquer autor OU followers de quem sigo;
    // followingIds vazio → só públicos (fallback explore, T026)
    OR: [
      { audience: "public" },
      { audience: "followers", authorId: { in: followingIds } },
    ],
    ...(keyset.length > 0 ? { AND: [{ OR: keyset }] } : {}),
  }

  const candidates = await prisma.post.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: POST_INCLUDE,
  })

  // S2-15: perfil privado → só seguidores
  const followingSet = new Set(followingIds)
  const visible = candidates.filter(
    (post) =>
      !hasPrivateProfile(post.author) || followingSet.has(post.authorId),
  )

  const ids = visible.map((post) => post.id)
  const now = new Date()

  const engagement = new Map<string, number>()
  const interactedPostIds = new Set<string>()

  if (ids.length > 0) {
    const twoHoursAgo = new Date(now.getTime() - ENGAGEMENT_WINDOW_MS)
    const [recentLikes, recentComments, viewerLikes, viewerComments] =
      await Promise.all([
        prisma.postLike.findMany({
          where: { postId: { in: ids }, createdAt: { gte: twoHoursAgo } },
          select: { postId: true },
        }),
        prisma.comment.findMany({
          where: { postId: { in: ids }, createdAt: { gte: twoHoursAgo } },
          select: { postId: true },
        }),
        prisma.postLike.findMany({
          where: { postId: { in: ids }, userId },
          select: { postId: true },
        }),
        prisma.comment.findMany({
          where: { postId: { in: ids }, authorId: userId },
          select: { postId: true },
        }),
      ])

    for (const like of recentLikes) {
      engagement.set(like.postId, (engagement.get(like.postId) ?? 0) + 1)
    }
    for (const comment of recentComments) {
      engagement.set(comment.postId, (engagement.get(comment.postId) ?? 0) + 2)
    }
    for (const like of viewerLikes) interactedPostIds.add(like.postId)
    for (const comment of viewerComments) interactedPostIds.add(comment.postId)
  }

  const ranked = applyPinnedCap(
    rankFeedPosts(visible, { engagementByPost: engagement, interactedPostIds }),
    pageSize,
  )
  const posts = ranked.page
  const droppedIds = ranked.dropped.map((post) => post.id)

  // pivot do cursor: menor (createdAt, id) desta página; fallback p/ a
  // janela quando todo candidato foi filtrado (garante progresso) e nunca
  // andando para trás do pivot recebido (página servida só via include)
  const pageOrWindowMin = minTuple(posts) ?? minTuple(candidates)
  let pivot = pageOrWindowMin
  if (parsed) {
    const incoming: FeedCursor = { createdAt: parsed.createdAt, id: parsed.id }
    pivot = pageOrWindowMin ? olderCursor(pageOrWindowMin, incoming) : incoming
  }

  const exhausted = candidates.length < take
  const hasPending = droppedIds.length > 0
  const nextCursor =
    pivot && (!exhausted || hasPending)
      ? encodeFeedCursor({ ...pivot, include: droppedIds })
      : null

  return { posts, nextCursor }
}
