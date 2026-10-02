"use client"

import { motion } from "framer-motion"
import { Heart, Lock, MessageCircle, Share2, Sparkles } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { ShareModal } from "@/components/social/share-modal"
import type { FeedPost } from "@/hooks/use-feed"
import { getR2PublicUrl } from "@/lib/r2-public-url"
import { linkifyMentionsHashtags } from "@/lib/social/mentions"
import { getInitials } from "@/lib/utils"

// `imageUrls` guarda CHAVES `posts/{userId}/…` (S2-12 — T051 valida o
// prefixo); a URL pública é montada aqui a partir de
// `NEXT_PUBLIC_R2_PUBLIC_URL` (single source em `@/lib/r2-public-url`).
const R2_BASE = getR2PublicUrl()

function resolveImageUrl(key: string): string {
  return /^https?:\/\//.test(key) ? key : `${R2_BASE}/${key}`
}

/** Timestamp relativo em pt-BR ("agora mesmo", "há 5 min", "há 2 h", "há 3 d"). */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const diff = now - Date.parse(iso)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "agora mesmo"
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `há ${days} d`
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
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
 * Ações: **compartilhar** abre o `ShareModal` (T063); **curtir/comentar**
 * renderizam as contagens com `aria-disabled` até os endpoints de like
 * (T076) e comentário (T077) existirem — sem comportamento falso.
 */
export function PostCard({ post }: PostCardProps) {
  const [shareOpen, setShareOpen] = useState(false)

  const name = post.author.displayName ?? post.author.name
  const images = post.imageUrls ?? []

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
          aria-label={`Curtir, ${post.likeCount} curtidas`}
          aria-disabled="true"
          className="inline-flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Heart className="h-4 w-4" aria-hidden="true" />
          {post.likeCount}
        </button>
        <button
          type="button"
          aria-label={`Comentar, ${post.commentCount} comentarios`}
          aria-disabled="true"
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

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        postId={post.id}
        title={name}
      />
    </motion.article>
  )
}
