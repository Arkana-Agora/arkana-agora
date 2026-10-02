"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import { z } from "zod"

import authApi from "@/lib/api"
import type { CreatePostInput } from "@/lib/validators/social"

const feedAuthorSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    displayName: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
    profile: z
      .object({ privacy: z.unknown() })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough()

export const feedPostSchema = z
  .object({
    id: z.string(),
    authorId: z.string(),
    type: z.enum(["text", "image", "reading"]),
    content: z.string(),
    imageUrls: z.array(z.string()).optional(),
    readingId: z.string().nullable().optional(),
    audience: z.enum(["public", "followers"]),
    isPinned: z.boolean().optional(),
    likeCount: z.number(),
    commentCount: z.number(),
    commentsDisabled: z.boolean().optional(),
    isHidden: z.boolean().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().optional(),
    author: feedAuthorSchema,
  })
  .passthrough()

export type FeedPost = z.infer<typeof feedPostSchema>

const feedUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  avatar: z.string().nullable(),
  role: z.string(),
  followersCount: z.number(),
})

export type FeedUser = z.infer<typeof feedUserSchema>

const hashtagSchema = z.object({
  tag: z.string(),
  count: z.number(),
})

const feedEnvelopeSchema = z.object({
  data: z.array(feedPostSchema),
  pagination: z.object({ nextCursor: z.string().nullable().optional() }),
})

/** Página normalizada do feed: `posts` + `nextCursor` (T061 consome assim). */
export type FeedPage = {
  posts: FeedPost[]
  nextCursor: string | null
}

type FeedQueryData = InfiniteData<FeedPage, string | null>

function feedKey(cursor?: string | null) {
  return ["feed", cursor ?? null] as const
}

// Bus do pill "N novos posts" (Q27/T061): o listener do `post:new` (T072)
// chama `emitPendingPost` e `useFeed` acumula com dedup por id.
type PendingListener = (post: FeedPost) => void
const pendingListeners = new Set<PendingListener>()

export function emitPendingPost(post: FeedPost): void {
  for (const listener of pendingListeners) listener(post)
}

/**
 * Feed infinito por cursor (T062/US-022): envelope S2-18
 * `{ data: Post[], pagination: { nextCursor } }`, páginas de 10 (S2-5),
 * queryKey `["feed", cursorInicial]`.
 *
 * Q27 (pill do T061): `pendingPosts` acumula posts novos emitidos por
 * `emitPendingPost` (dedup por id) e `flushPending()` os insere no topo da
 * primeira página (dedup contra os já visíveis) limpando a fila — com os
 * dados ainda não carregados a fila é mantida (não descarta).
 */
export function useFeed(cursor?: string | null) {
  const queryClient = useQueryClient()
  const [pendingPosts, setPendingPosts] = useState<FeedPost[]>([])

  useEffect(() => {
    const listener: PendingListener = (post) =>
      setPendingPosts((prev) =>
        prev.some((item) => item.id === post.id) ? prev : [post, ...prev],
      )
    pendingListeners.add(listener)
    return () => {
      pendingListeners.delete(listener)
    }
  }, [])

  const query = useInfiniteQuery({
    queryKey: feedKey(cursor),
    queryFn: async ({ pageParam }) => {
      const res = await authApi.get("/social/feed", {
        params: pageParam ? { cursor: pageParam } : {},
      })
      const envelope = feedEnvelopeSchema.parse(res.data)
      return {
        posts: envelope.data,
        nextCursor: envelope.pagination.nextCursor ?? null,
      } satisfies FeedPage
    },
    initialPageParam: cursor ?? null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const flushPending = useCallback(() => {
    if (pendingPosts.length === 0) return
    const data = queryClient.getQueryData<FeedQueryData>(feedKey(cursor))
    const first = data?.pages[0]
    // com os dados ainda não carregados a fila é mantida (não descarta)
    if (!data || !first) return
    // dedup contra TODAS as páginas já carregadas: um post pendente que já
    // apareceu numa página seguinte não pode ser reinserido no topo da
    // primeira (duplicava visualmente)
    const known = new Set(
      data.pages.flatMap((page) => page.posts.map((post) => post.id)),
    )
    const inserts = pendingPosts.filter((post) => !known.has(post.id))
    if (inserts.length > 0) {
      queryClient.setQueryData<FeedQueryData>(feedKey(cursor), {
        ...data,
        pages: [
          { ...first, posts: [...inserts, ...first.posts] },
          ...data.pages.slice(1),
        ],
      })
    }
    // a fila processada sai (inseridas estão no cache; já-conhecidas estão
    // visíveis); posts emitidos durante o flush ficam preservados
    const handled = new Set(pendingPosts.map((post) => post.id))
    setPendingPosts((prev) => prev.filter((post) => !handled.has(post.id)))
  }, [cursor, pendingPosts, queryClient])

  return { ...query, pendingPosts, flushPending }
}

/**
 * Criação de post (T062/US-021) — `POST /social/posts` (T051) e
 * invalida `["feed"]` para refazer as páginas já carregadas.
 */
export function useCreatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      const res = await authApi.post("/social/posts", input)
      const parsed = z
        .object({ data: z.object({ post: feedPostSchema }) })
        .parse(res.data)
      return parsed.data.post
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["feed"] })
    },
  })
}

/**
 * Trending de Explore (T062/US-022) — `GET /social/explore/trending`
 * (T053): `{ data: { posts } }` (sem paginação).
 */
export function useTrending() {
  return useQuery({
    queryKey: ["social", "trending"],
    queryFn: async () => {
      const res = await authApi.get("/social/explore/trending")
      const parsed = z
        .object({ data: z.object({ posts: z.array(feedPostSchema) }) })
        .parse(res.data)
      return parsed.data.posts
    },
  })
}

/**
 * Sugestões de quem seguir (T062/US-022) —
 * `GET /social/explore/suggestions` (T055): `{ data: { users } }`.
 */
export function useExploreSuggestions() {
  return useQuery({
    queryKey: ["social", "suggestions"],
    queryFn: async () => {
      const res = await authApi.get("/social/explore/suggestions")
      const parsed = z
        .object({ data: z.object({ users: z.array(feedUserSchema) }) })
        .parse(res.data)
      return parsed.data.users
    },
  })
}

export type SearchResult = {
  posts: FeedPost[]
  users: FeedUser[]
  hashtags: { tag: string; count: number }[]
}

/**
 * Busca social (T062/US-022) — `GET /social/search?q=` (T056): só roda
 * com `q` ≥ 2 chars (contrato do endpoint; abaixo disso a query fica
 * idle e evita o 422 do servidor).
 */
export function useSearch(q: string) {
  const trimmed = q.trim()
  return useQuery({
    queryKey: ["social", "search", trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async () => {
      const res = await authApi.get("/social/search", {
        params: { q: trimmed },
      })
      const parsed = z
        .object({
          data: z.object({
            posts: z.array(feedPostSchema),
            users: z.array(feedUserSchema),
            hashtags: z.array(hashtagSchema),
          }),
        })
        .parse(res.data)
      return parsed.data satisfies SearchResult
    },
  })
}
