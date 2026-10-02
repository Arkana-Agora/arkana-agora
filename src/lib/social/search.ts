import type { Prisma, UserRole } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  hasPrivateProfile,
  POST_INCLUDE,
  type FeedPost,
} from "@/lib/social/feed-algorithm"
import { rankHashtags, type TrendingHashtag } from "@/lib/social/explore"

type PostRow = Prisma.PostGetPayload<{ include: typeof POST_INCLUDE }>

/**
 * Busca unificada (T056, US-022): posts + usuários + hashtags numa única
 * chamada. Padrão `explore.ts`/`follow-lists.ts`: queries na lib, rota só
 * valida/envelopa.
 *
 * - **posts (S2-15, review v5)**: conteúdo case-insensitive; público OU
 *   `followers` de quem o viewer segue; autor ativo/não-banido/não-oculto;
 *   perfil `private` só aparece para quem segue (mesmo predicado do
 *   `getFeed`). `isHidden`/`isBanned` também são requisito do T129 — aqui
 *   já aplicados (mesma regra do feed/T053, consistência).
 * - **usuários**: nome OU username case-insensitive (convenção das listas
 *   de follow); ativos; exclui perfis `private`; ordena por followers
 *   desc. Item no shape das sugestões (T055).
 * - **hashtags**: `tag` lowercase (armazenamento canônico de
 *   `parseHashtags`), sem janela de tempo (diferente do trending), agregado
 *   por `rankHashtags`.
 *
 * Limites fixos de 20 por seção; sem cursor (S2-18 cobre rotas cursor — a
 * busca responde `{ data: { posts, users, hashtags } }`).
 */

export const SEARCH_LIMIT = 20

export interface SearchUser {
  id: string
  name: string
  username: string | null
  avatar: string | null
  role: UserRole
  followersCount: number
}

export interface SocialSearchResult {
  posts: FeedPost[]
  users: SearchUser[]
  hashtags: TrendingHashtag[]
}

export async function searchSocial(
  viewerId: string,
  rawQuery: string,
): Promise<SocialSearchResult> {
  const q = rawQuery.trim()

  const following = await prisma.follow.findMany({
    where: { followerId: viewerId },
    select: { followingId: true },
  })
  const followingIds = following.map((f) => f.followingId)
  const followingSet = new Set(followingIds)

  // Posts em lotes keyset: o predicado de perfil `private` (fail-closed de
  // `hasPrivateProfile`) só é aplicável após o fetch, então um único
  // `take: 20` retornaria páginas curtas quando há privados entre os 20
  // primeiros — busca em lotes até completar SEARCH_LIMIT ou esgotar.
  const postsPromise = (async () => {
    const postWhere = {
      content: { contains: q, mode: "insensitive" as const },
      isHidden: false,
      author: { isBanned: false, deletedAt: null, isActive: true },
      OR: [
        { audience: "public" as const },
        { audience: "followers" as const, authorId: { in: followingIds } },
      ],
    }
    const collected: PostRow[] = []
    let cursor: { createdAt: Date; id: string } | undefined
    while (collected.length < SEARCH_LIMIT) {
      const rows = await prisma.post.findMany({
        where: postWhere,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: SEARCH_LIMIT,
        ...(cursor ? { cursor, skip: 1 } : {}),
        include: POST_INCLUDE,
      })
      for (const row of rows) {
        if (collected.length >= SEARCH_LIMIT) break
        if (!hasPrivateProfile(row.author) || followingSet.has(row.authorId)) {
          collected.push(row)
        }
      }
      if (rows.length < SEARCH_LIMIT) break
      const last = rows[rows.length - 1]!
      cursor = { createdAt: last.createdAt, id: last.id }
    }
    return collected
  })()

  const [postRows, userRows, hashtagRows] = await Promise.all([
    postsPromise,
    prisma.user.findMany({
      where: {
        isActive: true,
        isBanned: false,
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { profile: { username: { contains: q, mode: "insensitive" } } },
        ],
      },
      orderBy: [{ followers: { _count: "desc" } }, { createdAt: "desc" }],
      take: SEARCH_LIMIT,
      select: {
        id: true,
        name: true,
        displayName: true,
        avatar: true,
        role: true,
        profile: { select: { username: true, privacy: true } },
        _count: { select: { followers: true } },
      },
    }),
    prisma.postHashtag.findMany({
      where: {
        tag: { contains: q.toLowerCase() },
        post: {
          audience: "public",
          isHidden: false,
          author: { isBanned: false, deletedAt: null, isActive: true },
        },
      },
      // headroom: `rankHashtags` descarta autores com perfil `private` e
      // NÃO repõe — 10× o limite evita varrer o histórico inteiro
      take: SEARCH_LIMIT * 10,
      select: {
        tag: true,
        post: {
          select: {
            author: { select: { profile: { select: { privacy: true } } } },
          },
        },
      },
    }),
  ])

  const users = userRows
    .filter((user) => !hasPrivateProfile(user))
    .map((user) => ({
      id: user.id,
      name: user.displayName ?? user.name,
      username: user.profile?.username ?? null,
      avatar: user.avatar,
      role: user.role,
      followersCount: user._count.followers,
    }))

  return {
    posts: postRows,
    users,
    hashtags: rankHashtags(hashtagRows, SEARCH_LIMIT),
  }
}
