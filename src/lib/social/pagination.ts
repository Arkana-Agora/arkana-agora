import { Prisma } from "@prisma/client"
import { canViewPost } from "./post-visibility"
import { decodeFeedCursor, encodeFeedCursor } from "./feed-algorithm"

export interface PaginationParams {
  cursor?: string | null
  limit?: number
  maxLimit?: number
  defaultLimit?: number
}

export interface PaginationResult<T> {
  data: T[]
  nextCursor: string | null
}

/**
 * Normaliza parâmetros de paginação (cursor + limit) com validações.
 */
export function normalizePaginationParams(
  params: PaginationParams,
): Required<PaginationParams> {
  return {
    cursor: params.cursor ?? null,
    limit: Math.min(
      Math.max(params.limit ?? params.defaultLimit ?? 10, 1),
      params.maxLimit ?? 50,
    ),
    maxLimit: params.maxLimit ?? 50,
    defaultLimit: params.defaultLimit ?? 10,
  }
}

/**
 * Gera a cláusula keyset `(createdAt, id)` para cursor-based pagination.
 * Retorna `null` se cursor inválido (página vazia sem DB hit).
 */
export function buildKeysetClause(cursor: string | null): Prisma.Sql | null {
  if (!cursor) return null
  const parsed = decodeFeedCursor(cursor)
  if (!parsed) return null
  return Prisma.sql`
    AND (
      c."createdAt" < ${new Date(parsed.createdAt)}::timestamptz
      OR (
        c."createdAt" = ${new Date(parsed.createdAt)}::timestamptz
        AND c.id < ${parsed.id}
      )
    )
  `
}

type OrderByInput =
  Prisma.CommentOrderByWithRelationInput | Prisma.PostOrderByWithRelationInput

/**
 * Executa paginação com cursor keyset.
 * Retorna `take + 1` para detectar `hasMore` e codifica `nextCursor`.
 */
export async function paginateWithCursor<T>({
  tx,
  baseWhere,
  cursor,
  limit,
  orderBy = [{ createdAt: "desc" }, { id: "desc" }],
}: {
  tx: Prisma.TransactionClient
  baseWhere: Record<string, unknown>
  cursor: string | null
  limit: number
  orderBy?: OrderByInput | OrderByInput[]
}): Promise<PaginationResult<T>> {
  const keyset = buildKeysetClause(cursor)

  const whereClause = keyset ? { ...baseWhere, AND: keyset } : baseWhere

  const rows = await (tx as Prisma.TransactionClient).comment.findMany({
    where: whereClause,
    orderBy,
    take: limit + 1,
  })

  const typedRows = rows as T[]
  const hasMore = typedRows.length > limit
  const shown = typedRows.slice(0, limit)

  const last = shown[shown.length - 1]
  const nextCursor =
    hasMore &&
    last &&
    typeof last === "object" &&
    "createdAt" in last &&
    "id" in last
      ? encodeFeedCursor({
          createdAt: new Date(last.createdAt as string | Date).getTime(),
          id: last.id as string,
        })
      : null

  return {
    data: shown,
    nextCursor,
  }
}

/**
 * Valida se um post é visível para o viewer (reutiliza `canViewPost`).
 * Lança erro 404 uniforme se não visível (anti-enumeration Q28).
 */
export async function assertPostVisible(
  tx: Prisma.TransactionClient,
  postId: string,
  viewerId: string,
): Promise<{
  id: string
  authorId: string
  audience: string
  isHidden: boolean
  author: {
    isBanned: boolean
    deletedAt: Date | null
    isActive: boolean
    profile: { privacy: unknown } | null
  }
}> {
  const post = await tx.post.findUnique({
    where: { id: postId },
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

  if (!post || !(await canViewPost(post, viewerId))) {
    throw new Error("POST_NOT_FOUND")
  }

  return post
}

/**
 * Filtro padrão para autores ativos (LGPD soft-delete window).
 */
export const ACTIVE_AUTHOR_WHERE = {
  isActive: true,
  isBanned: false,
  deletedAt: null,
} as const

/**
 * Filtro padrão para comentários não removidos (soft-delete via content marker).
 */
export const NOT_REMOVED_CONTENT = {
  content: { not: "[removido]" },
} as const
