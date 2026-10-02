import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { hasPrivateProfile } from "@/lib/social/feed-algorithm"

/**
 * Predicado único de visibilidade de post na leitura (S2-15 + Q28/anti-
 * timing) — compartilhado por `GET /social/posts/:id` (T057) e pelo
 * og-image (T058), garantindo semântica idêntica nos dois caminhos
 * (CHK006).
 *
 * Post é invisível (todos respondem **404 `POST_NOT_FOUND` uniforme**,
 * sem distinguir os casos — anti-timing) quando:
 * 1. não existe;
 * 2. `isHidden` (moderação);
 * 3. autor banido, soft-deleted ou inativo;
 * 4. `audience = "followers"` e o viewer não segue o autor;
 * 5. perfil do autor `profileVisibility = "private"` e o viewer não segue.
 *
 * Exceção: o próprio autor vê o próprio post sem depender de follow —
 * exceto quando o post está `isHidden` ou o autor está banido/inativo
 * (esses checks vêm antes, comportamento propositalmente mais restritivo).
 */

export const POST_DETAIL_AUTHOR_SELECT = {
  id: true,
  name: true,
  displayName: true,
  avatar: true,
  isBanned: true,
  deletedAt: true,
  isActive: true,
  profile: { select: { privacy: true } },
} satisfies Prisma.UserSelect

export type PostWithAuthor = Prisma.PostGetPayload<{
  include: { author: { select: typeof POST_DETAIL_AUTHOR_SELECT } }
}>

export interface ViewablePost {
  authorId: string
  audience: string
  isHidden: boolean
  author: {
    isBanned: boolean
    deletedAt: Date | null
    isActive: boolean
    profile: { privacy?: unknown } | null
  }
}

/**
 * O post é "gated" quando exige relação de follow para ser lido:
 * `audience = "followers"` OU perfil do autor `private`.
 */
export function postIsGated(post: ViewablePost): boolean {
  return post.audience === "followers" || hasPrivateProfile(post.author)
}

/**
 * `viewerId` pode ser `null` (og-image é público — crawlers chegam sem
 * token): nesse caso gated → `false` **sem** consultar follow.
 */
export async function canViewPost(
  post: ViewablePost | null,
  viewerId: string | null,
): Promise<boolean> {
  if (!post) return false
  if (post.isHidden) return false
  if (post.author.isBanned || post.author.deletedAt || !post.author.isActive) {
    return false
  }
  if (viewerId !== null && post.authorId === viewerId) return true
  if (!postIsGated(post)) return true
  if (viewerId === null) return false

  const follow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: viewerId,
        followingId: post.authorId,
      },
    },
    select: { id: true },
  })
  return follow !== null
}

/**
 * Projeção pública de um post na resposta (review Phase 2): os campos do
 * predicado (`isBanned`, `deletedAt`, `isActive`, `profile.privacy`) são
 * internos do servidor — a privacy "nunca sai na resposta" (princípio já
 * documentado em `explore.ts`) e os internals do predicado também não.
 * Remove apenas o que existir no select; o restante do autor (id, name,
 * displayName, avatar) é repassado como está.
 */
export function toPublicPost<
  T extends {
    author: {
      isBanned?: unknown
      deletedAt?: unknown
      isActive?: unknown
      profile?: unknown
    }
  },
>(
  post: T,
): Omit<T, "author"> & {
  author: Omit<T["author"], "isBanned" | "deletedAt" | "isActive" | "profile">
} {
  const { isBanned, deletedAt, isActive, profile, ...publicAuthor } =
    post.author
  void isBanned
  void deletedAt
  void isActive
  void profile
  // cast único e isolado: o TS não expressa Omit-through-spread em genérico
  return {
    ...post,
    author: publicAuthor,
  } as Omit<T, "author"> & {
    author: Omit<T["author"], "isBanned" | "deletedAt" | "isActive" | "profile">
  }
}
