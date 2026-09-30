import type { Prisma } from "@prisma/client"

import { decodeFeedCursor, encodeFeedCursor } from "@/lib/social/feed-algorithm"
import { prisma } from "@/lib/prisma"

/**
 * Listas de followers/following (T044/T045): keyset pagination com o
 * cursor do feed (`{createdAt, id}` base64url) e envelope de rota
 * `{ data, pagination: { nextCursor } }` (S2-18/SC30).
 */

export const FOLLOW_LIST_DEFAULT_LIMIT = 20
export const FOLLOW_LIST_MAX_LIMIT = 50

/**
 * Contadores de follow com o MESMO filtro das listas e do profile
 * (SC39): banidos/soft-deleted nao contam em nenhum dos tres call sites
 * (toggle T043, profile T046, listas T044/T045) — sem isso o toggle
 * respondia um numero diferente do profile para a mesma relacao.
 */
export async function readFollowCounts(
  db: Pick<Prisma.TransactionClient, "follow">,
  viewerId: string,
  targetId: string,
): Promise<{ followingCount: number; followersCount: number }> {
  const followingCount = await db.follow.count({
    where: {
      followerId: viewerId,
      following: { isActive: true, isBanned: false, deletedAt: null },
    },
  })
  const followersCount = await db.follow.count({
    where: {
      followingId: targetId,
      follower: { isActive: true, isBanned: false, deletedAt: null },
    },
  })
  return { followingCount, followersCount }
}

export type FollowListSide = "followers" | "following"

export interface FollowListItem {
  userId: string
  name: string
  username: string | null
  avatarUrl: string | null
  isFollowing?: boolean
}

export interface FollowListPage {
  data: FollowListItem[]
  nextCursor: string | null
}

interface RelatedUser {
  id: string
  name: string
  displayName: string
  avatar: string | null
  profile: { username: string | null } | null
}

const userSelect = {
  id: true,
  name: true,
  displayName: true,
  avatar: true,
  profile: { select: { username: true } },
} satisfies Prisma.UserSelect

export async function listFollows(options: {
  side: FollowListSide
  targetUserId: string
  cursor?: string | null
  q?: string | null
  limit?: number
  viewerId?: string | null
}): Promise<FollowListPage> {
  const { side, targetUserId, cursor, q, viewerId } = options
  const pageSize = Math.min(
    Math.max(
      Number.isFinite(options.limit)
        ? (options.limit as number)
        : FOLLOW_LIST_DEFAULT_LIMIT,
      1,
    ),
    FOLLOW_LIST_MAX_LIMIT,
  )

  const parsed = cursor ? decodeFeedCursor(cursor) : null
  if (cursor && !parsed) {
    // contrato do feed (T026): cursor invalido → pagina vazia, sem
    // restart no topo (evitaria duplicar conteudo em loop)
    return { data: [], nextCursor: null }
  }

  const relation = side === "followers" ? "follower" : "following"
  const search = q?.trim()

  // grupos de condicao em AND: busca (q) e keyset (cursor) nao podem
  // competir pela mesma chave OR — o segundo sobrescreveria o primeiro
  const groups: Prisma.FollowWhereInput[] = []
  if (search) {
    groups.push({
      OR: [
        {
          [relation]: {
            name: { contains: search, mode: "insensitive" as const },
          },
        },
        {
          [relation]: {
            profile: {
              username: { contains: search, mode: "insensitive" as const },
            },
          },
        },
      ],
    })
  }
  if (parsed) {
    groups.push({
      OR: [
        { createdAt: { lt: new Date(parsed.createdAt) } },
        { createdAt: new Date(parsed.createdAt), id: { lt: parsed.id } },
      ],
    })
  }

  const where: Prisma.FollowWhereInput = {
    ...(side === "followers"
      ? { followingId: targetUserId }
      : { followerId: targetUserId }),
    // usuarios inativos, banidos ou na janela LGPD de soft-delete nao
    // aparecem (mesma regra do guard de autor em feed-algorithm, S2-15;
    // o padrao exige os DOIS checks de soft-delete + isActive)
    [relation]: { isActive: true, isBanned: false, deletedAt: null },
    ...(groups.length > 0 ? { AND: groups } : {}),
  }

  const orderBy: Prisma.FollowOrderByWithRelationInput[] = [
    { createdAt: "desc" },
    { id: "desc" },
  ]
  const take = pageSize + 1

  const rows = (await prisma.follow.findMany({
    where,
    orderBy,
    take,
    include: { [relation]: { select: userSelect } },
  })) as unknown as Array<{
    id: string
    followerId: string
    followingId: string
    createdAt: Date
    follower?: RelatedUser
    following?: RelatedUser
  }>

  const hasMore = rows.length > pageSize
  const shown = rows.slice(0, pageSize)

  let items: FollowListItem[] = []
  for (const row of shown) {
    const user = side === "followers" ? row.follower : row.following
    if (!user) continue
    items.push({
      userId: user.id,
      name: user.displayName ?? user.name,
      username: user.profile?.username ?? null,
      avatarUrl: user.avatar,
    })
  }

  if (viewerId && items.length > 0) {
    const listedIds = items.map((item) => item.userId)
    const viewerFollows = await prisma.follow.findMany({
      where: { followerId: viewerId, followingId: { in: listedIds } },
      select: { followingId: true },
    })
    const followingSet = new Set(viewerFollows.map((f) => f.followingId))
    items = items.map((item) => ({
      ...item,
      isFollowing: followingSet.has(item.userId),
    }))
  }

  const last = shown[shown.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeFeedCursor({ createdAt: last.createdAt.getTime(), id: last.id })
      : null

  return { data: items, nextCursor }
}
