"use client"

import { motion } from "framer-motion"
import { Heart, Lock, MessageCircle, Share2, Sparkles } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { CommentSection } from "@/components/social/comment-section"
import { ShareModal } from "@/components/social/share-modal"
import type { FeedPost } from "@/hooks/use-feed"
import authApi from "@/lib/api"
import { getR2PublicUrl } from "@/lib/r2-public-url"
import { linkifyMentionsHashtags } from "@/lib/social/mentions"
import { formatRelativeTime } from "@/lib/social/relative-time"
import { getInitials } from "@/lib/utils"
import { useSocialStore } from "@/stores/social-store"

// Resposta do toggle T076 — `{ data: { liked, likeCount } }`.
const likeResponseSchema = z.object({
  data: z.object({ liked: z.boolean(), likeCount: z.number() }),
})

// `imageUrls` guarda CHAVES `posts/{userId}/…` (S2-12 — T051 valida o
// prefixo); a URL pública é montada aqui a partir de
// `NEXT_PUBLIC_R2_PUBLIC_URL` (single source em `@/lib/r2-public-url`).
const R2_BASE = getR2PublicUrl()

function resolveImageUrl(key: string): string {
  return /^https?:\/\//.test(key) ? key : `${R2_BASE}/${key}`
}

interface PostCardProps {
  post: FeedPost
}

/**
 * Card de post do feed (T059/US-021): avatar + nome (`displayName ?? name`),
 * timestamp relativo, corpo linkificado (menções/hashtags via T031 — HTML
 * escapado antes das âncoras, seguro para `dangerouslySetInnerHTML`), grid de
 * imagens (até 4), preview de tiragem e barra de ações.
 *
 * Ações (T085): **compartilhar** abre o `ShareModal` (T063); **curtir**
 * alterna via `POST /social/posts/:id/like` (T076) com overlay otimista no
 * SocialStore (`updatePostLike`, reconciliação com o servidor e rollback em
 * erro); **comentar** alterna a `CommentSection` (T085) — posts com
 * `commentsDisabled` mantêm o botão inerte (`aria-disabled`, sem
 * comportamento falso).
 */
export function PostCard({ post }: PostCardProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [likePending, setLikePending] = useState(false)

  const likeOverlay = useSocialStore((state) => state.postLikes[post.id])
  const updatePostLike = useSocialStore((state) => state.updatePostLike)

  // Revsao R6: sem overlay, o estado vem do SERVIDOR (`viewerHasLiked`) —
  // antes o liked sempre nascia `false` e o servidor nunca era consultado.
  const liked = likeOverlay?.liked ?? post.viewerHasLiked ?? false
  const likeCount = likeOverlay?.likeCount ?? post.likeCount
  const commentsDisabled = post.commentsDisabled ?? false

  const name = post.author.displayName ?? post.author.name
  const images = post.imageUrls ?? []

  async function handleLike() {
    if (likePending) return
    const previous = { liked, likeCount }
    setLikePending(true)
    updatePostLike(post.id, !liked, liked ? likeCount - 1 : likeCount + 1)
    try {
      const res = await authApi.post(`/social/posts/${post.id}/like`)
      const data = likeResponseSchema.parse(res.data).data
      updatePostLike(post.id, data.liked, data.likeCount)
    } catch {
      updatePostLike(post.id, previous.liked, previous.likeCount)
      toast.error("Nao foi possivel curtir. Tente novamente.")
    } finally {
      setLikePending(false)
    }
  }

  function toggleComments() {
    if (commentsDisabled) return
    setCommentsOpen((open) => !open)
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      data-testid={`post-${post.id}`}
      className="bg-card border border-border rounded-xl p-4 space-y-3"
    >
      <header className="flex items-center gap-3">
        {post.author.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.author.avatar}
            alt={`Foto de ${name}`}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium"
          >
            {getInitials(name)}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground">
            <time dateTime={post.createdAt}>
              {formatRelativeTime(post.createdAt)}
            </time>
          </p>
        </div>
        {post.audience === "followers" && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Seguidores
          </span>
        )}
      </header>

      {post.content && (
        <div
          className="whitespace-pre-wrap break-words text-sm leading-relaxed [&_a]:text-primary [&_a]:underline"
          dangerouslySetInnerHTML={{
            __html: linkifyMentionsHashtags(post.content),
          }}
        />
      )}

      {post.type === "reading" && post.readingId && (
        <Link
          href={`/tiragem/${post.readingId}`}
          className="inline-flex items-center gap-2 text-sm bg-muted hover:bg-muted/70 transition-colors rounded-lg px-3 py-2"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Ver tiragem
        </Link>
      )}

      {images.length > 0 && (
        <div
          className={`grid gap-1 rounded-xl overflow-hidden ${
            images.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {images.map((key, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={key}
              src={resolveImageUrl(key)}
              alt={`Imagem ${index + 1} do post`}
              loading="lazy"
              className="w-full h-48 object-cover"
            />
          ))}
        </div>
      )}

      <footer className="flex items-center gap-1 pt-1 border-t border-border">
        <button
          type="button"
          aria-label={`Curtir, ${likeCount} curtidas`}
          aria-pressed={liked}
          onClick={() => void handleLike()}
          className={`inline-flex items-center gap-1.5 px-2 py-1.5 text-sm transition-colors ${
            liked
              ? "text-red-500"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart
            className={`h-4 w-4 ${liked ? "fill-current" : ""}`}
            aria-hidden="true"
          />
          {likeCount}
        </button>
        <button
          type="button"
          aria-label={`Comentar, ${post.commentCount} comentarios`}
          aria-disabled={commentsDisabled ? "true" : undefined}
          onClick={toggleComments}
          className="inline-flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          {post.commentCount}
        </button>
        <button
          type="button"
          aria-label="Compartilhar"
          onClick={() => setShareOpen(true)}
          className="inline-flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Compartilhar
        </button>
      </footer>

      {commentsOpen && !commentsDisabled && <CommentSection postId={post.id} />}

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        postId={post.id}
        title={name}
      />
    </motion.article>
  )
}
