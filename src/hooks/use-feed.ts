"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { z } from "zod"

import authApi from "@/lib/api"
import { useSocket } from "@/hooks/use-socket"
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

/**
 * Revisão T: teto da fila do pill — flood de `new-post` (ou polling
 * offline prolongado) não cresce a fila sem limite; o corte mantém os
 * MAIS NOVOS (inserção no topo) e descarta os mais antigos.
 */
export const PENDING_POSTS_CAP = 50

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
      setPendingPosts((prev) => {
        if (prev.some((item) => item.id === post.id)) return prev
        // Revisão T: cap de 50 mantendo os mais novos (topo)
        return [post, ...prev].slice(0, PENDING_POSTS_CAP)
      })
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
 * Janela de batching do realtime do feed (revisão Q): rajadas de
 * `new-post` viram UMA chamada ao endpoint de polling
 * (`GET /social/polling/posts?since=`) — sem N+1 (antes: 1 GET por
 * evento). A janela abre no primeiro evento e dura 300ms; ids do lote
 * só saem da fila em caso de sucesso (falha re-enfileira p/ retry).
 */
const FEED_REALTIME_BATCH_MS = 300

// Revisão R1: re-tenta o lote que falhou sem esperar um novo evento —
// 3s (não os 300ms da janela normal) para não martelar o bucket de rate
// limit "polling" (60/min) quando o servidor está fora.
const FEED_REALTIME_RETRY_MS = 3000

const pollingPostsEnvelopeSchema = z.object({
  data: z.object({ posts: z.array(feedPostSchema) }),
  serverTime: z.string().optional(),
})

/**
 * Revisão R1 (mesma semântica de `pollingCursor` em use-socket, revisão S):
 * o cursor só avança até o `serverTime` da resposta — nunca além do
 * relógio do cliente — para não pular posts por skew de relógio.
 */
function advanceSinceCursor(requestedAt: string, serverTime?: string): string {
  if (serverTime === undefined) return requestedAt
  const serverMs = Date.parse(serverTime)
  if (Number.isNaN(serverMs)) return requestedAt
  return serverMs < Date.parse(requestedAt) ? serverTime : requestedAt
}

/**
 * Listener realtime do feed (T072/Q27): eventos `new-post` do WebSocket
 * são agrupados numa janela de 300ms e resolvidos com UMA consulta ao
 * fallback de polling (revisão Q — sem 1 GET por evento); apenas os ids
 * que chegaram por evento viram pill "N novos posts" via
 * `emitPendingPost` (dedup por id acontece na fila, `useFeed`). Falha
 * offline: janela preservada para retry e falha engolida (sem crash).
 */
export function useFeedRealtime(): void {
  const idsRef = useRef<Set<string>>(new Set())
  const sinceRef = useRef<string>(new Date().toISOString())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Revisão R1: o retry do catch re-agenda via ref (o flush não pode se
  // referenciar antes da própria declaração no useCallback)
  const flushRef = useRef<() => void>(() => undefined)

  const flush = useCallback(() => {
    timerRef.current = null
    const batch = idsRef.current
    idsRef.current = new Set()
    const since = sinceRef.current
    const requestedAt = new Date().toISOString()
    void authApi
      .get("/social/polling/posts", { params: { since } })
      .then((res) => {
        const envelope = pollingPostsEnvelopeSchema.parse(res.data)
        const posts = envelope.data.posts
        // só avança a janela quando não há backlog (um evento que chegou
        // durante o voo seria perdido por `createdAt > since`) e nunca
        // além do serverTime do servidor (revisão R1 — skew de relógio)
        if (idsRef.current.size === 0) {
          sinceRef.current = advanceSinceCursor(
            requestedAt,
            envelope.serverTime,
          )
        }
        const wanted = posts.filter((post) => batch.has(post.id))
        // mais novo por último no prepend → topo do pill = post mais novo
        for (const post of [...wanted].reverse()) emitPendingPost(post)
      })
      .catch(() => {
        // Revisão R1: re-enfileira o lote E re-agenda o retry — sem um
        // novo evento o pill nunca sairia da fila (timer já zerado)
        idsRef.current = new Set([...idsRef.current, ...batch])
        if (timerRef.current === null) {
          timerRef.current = setTimeout(
            () => flushRef.current(),
            FEED_REALTIME_RETRY_MS,
          )
        }
      })
  }, [])

  useEffect(() => {
    flushRef.current = flush
  })

  useSocket({
    "new-post": (event) => {
      idsRef.current.add(event.postId)
      if (timerRef.current === null) {
        timerRef.current = setTimeout(flush, FEED_REALTIME_BATCH_MS)
      }
    },
  })

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    },
    [],
  )
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
