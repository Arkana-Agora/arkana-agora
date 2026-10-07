"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { Heart } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import authApi from "@/lib/api"
import { MAX_COMMENT_CONTENT } from "@/lib/validators/social"
import { useSocialStore } from "@/stores/social-store"
import type { SocialComment } from "@/stores/social-store"

const commentAuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().nullable(),
  avatar: z.string().nullable(),
})

const commentSchema: z.ZodType<SocialComment, z.ZodTypeDef, unknown> = z.lazy(
  () =>
    z.object({
      id: z.string(),
      postId: z.string(),
      content: z.string(),
      likeCount: z.number(),
      parentCommentId: z.string().nullable(),
      createdAt: z.string(),
      author: commentAuthorSchema,
      replies: z.array(commentSchema).default([]),
    }),
)

const commentsEnvelopeSchema = z.object({
  data: z.array(commentSchema),
  pagination: z.object({ nextCursor: z.string().nullable().optional() }),
})

const createCommentResponseSchema = z.object({
  data: z.object({ comment: commentSchema }),
})

const commentLikeResponseSchema = z.object({
  data: z.object({ liked: z.boolean(), likeCount: z.number() }),
})

interface CommentSectionProps {
  postId: string
}

/**
 * CommentSection (T085/US-023): lista de comentários (raízes + respostas de
 * nível 1 — RF-SOC-005), composer (≤300 chars), "Carregar mais" por cursor e
 * like por comentário (T081, contagem apenas — Q24).
 *
 * - Lista via React Query (`["comments", postId]`, envelope S2-18 da T078);
 *   comentários criados entram otimistas no SocialStore
 *   (`addCommentToPost`, dedup por id) e são reconciliados pelo refetch.
 * - Resposta fixa `parentCommentId` no composer (aninhamento de 1 nível).
 * - Erros de rede → toast (texto do input preservado).
 */
export function CommentSection({ postId }: CommentSectionProps) {
  const queryClient = useQueryClient()
  const rawStoreComments = useSocialStore((state) => state.postComments[postId])
  const rawCommentLikes = useSocialStore((state) => state.commentLikes)
  const addCommentToPost = useSocialStore((state) => state.addCommentToPost)
  const updateCommentLike = useSocialStore((state) => state.updateCommentLike)
  const storeComments = rawStoreComments ?? []
  const storeCommentLikes = rawCommentLikes ?? {}

  const [draft, setDraft] = useState("")
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(
    null,
  )
  const [commentLikePending, setCommentLikePending] = useState<Set<string>>(
    new Set(),
  )

  const query = useInfiniteQuery({
    queryKey: ["comments", postId],
    queryFn: async ({ pageParam }) => {
      const res = await authApi.get(`/social/posts/${postId}/comments`, {
        params: pageParam ? { cursor: pageParam } : {},
      })
      const envelope = commentsEnvelopeSchema.parse(res.data)
      return {
        comments: envelope.data,
        nextCursor: envelope.pagination.nextCursor ?? null,
      }
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const createMutation = useMutation({
    mutationFn: (input: { content: string; parentCommentId?: string }) =>
      authApi.post(`/social/posts/${postId}/comments`, input),
    onSuccess: (res) => {
      const { comment } = createCommentResponseSchema.parse(res.data).data
      addCommentToPost(postId, comment)
      setDraft("")
      setReplyTo(null)
      void queryClient.invalidateQueries({ queryKey: ["comments", postId] })
      void queryClient.invalidateQueries({ queryKey: ["feed"] })
    },
    onError: () => {
      toast.error("Nao foi possivel comentar. Tente novamente.")
    },
  })

  const likeMutation = useMutation({
    mutationFn: (commentId: string) =>
      authApi.post(`/social/comments/${commentId}/like`),
  })

  const queryRoots = (query.data?.pages ?? []).flatMap((page) => page.comments)
  const storeRoots = storeComments.filter((comment) => !comment.parentCommentId)
  const storeReplies = storeComments.filter(
    (comment) => comment.parentCommentId !== null,
  )
  const queryRootIds = new Set(queryRoots.map((comment) => comment.id))
  const roots = [
    ...storeRoots.filter((comment) => !queryRootIds.has(comment.id)),
    ...queryRoots,
  ]

  function repliesFor(root: SocialComment): SocialComment[] {
    const queryReplies = root.replies ?? []
    const queryReplyIds = new Set(queryReplies.map((reply) => reply.id))
    const extras = storeReplies.filter(
      (reply) =>
        reply.parentCommentId === root.id && !queryReplyIds.has(reply.id),
    )
    return [...extras, ...queryReplies]
  }

  function likeOf(comment: SocialComment) {
    return (
      storeCommentLikes[comment.id] ?? {
        liked: false,
        likeCount: comment.likeCount,
      }
    )
  }

  function handleLike(comment: SocialComment) {
    if (commentLikePending.has(comment.id)) return
    const current = likeOf(comment)
    const optimistic = {
      liked: !current.liked,
      likeCount: current.liked ? current.likeCount - 1 : current.likeCount + 1,
    }
    setCommentLikePending((prev) => new Set(prev).add(comment.id))
    updateCommentLike(comment.id, optimistic.liked, optimistic.likeCount)
    likeMutation.mutate(comment.id, {
      onSuccess: (res) => {
        const data = commentLikeResponseSchema.parse(res.data).data
        updateCommentLike(comment.id, data.liked, data.likeCount)
      },
      onError: () => {
        updateCommentLike(comment.id, current.liked, current.likeCount)
        toast.error("Nao foi possivel curtir o comentario. Tente novamente.")
      },
      onSettled: () => {
        setCommentLikePending((prev) => {
          const next = new Set(prev)
          next.delete(comment.id)
          return next
        })
      },
    })
  }

  function handleSubmit() {
    const content = draft.trim()
    if (!content || createMutation.isPending) return
    createMutation.mutate(
      replyTo ? { content, parentCommentId: replyTo.id } : { content },
    )
  }

  function renderComment(comment: SocialComment, isReply: boolean) {
    const like = likeOf(comment)
    return (
      <li
        key={comment.id}
        data-testid={`comment-${comment.id}`}
        className={isReply ? "pl-4 border-l border-border" : undefined}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">
            {comment.author.displayName ?? comment.author.name}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words">
          {comment.content}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            aria-label={`Curtir comentário, ${like.likeCount} curtidas`}
            aria-pressed={like.liked}
            onClick={() => handleLike(comment)}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Heart
              className={`h-3.5 w-3.5 ${like.liked ? "fill-current" : ""}`}
              aria-hidden="true"
            />
            {like.likeCount}
          </button>
          {!isReply && (
            <button
              type="button"
              onClick={() =>
                setReplyTo({
                  id: comment.id,
                  name: comment.author.displayName ?? comment.author.name,
                })
              }
              className="hover:text-foreground transition-colors"
            >
              Responder
            </button>
          )}
        </div>
        {!isReply && repliesFor(comment).length > 0 && (
          <ul className="mt-2 space-y-2">
            {repliesFor(comment).map((reply) => renderComment(reply, true))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <section className="pt-3 space-y-3" data-testid="comment-section">
      <h3 className="text-sm font-semibold">Comentários</h3>

      {roots.length > 0 ? (
        <ul className="space-y-3">
          {roots.map((comment) => renderComment(comment, false))}
        </ul>
      ) : null}

      {query.hasNextPage && (
        <button
          type="button"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="text-sm text-primary hover:underline disabled:opacity-50"
        >
          Carregar mais
        </button>
      )}

      <div className="space-y-2">
        {replyTo && (
          <p className="text-xs text-muted-foreground">
            {`Respondendo a ${replyTo.name}`}
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="ml-2 text-primary hover:underline"
            >
              Cancelar
            </button>
          </p>
        )}
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Escreva um comentario..."
          maxLength={MAX_COMMENT_CONTENT}
          rows={2}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!draft.trim() || createMutation.isPending}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Comentar
        </button>
      </div>
    </section>
  )
}
