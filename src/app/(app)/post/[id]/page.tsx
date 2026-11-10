"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { PostCard } from "@/components/social/post-card"
import { CommentSection } from "@/components/social/comment-section"
import { ShareModal } from "@/components/social/share-modal"
import { usePost } from "@/hooks/use-feed"

export default function PostDetailPage() {
  const router = useRouter()
  const params = useParams()
  const postId = params.id as string
  const { data: post, isLoading, error } = usePost(postId)
  const [shareModalOpen, setShareModalOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <svg
          className="h-8 w-8 animate-spin text-primary"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="sr-only">Carregando post...</span>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">
            {error instanceof Error ? error.message : "Post nao encontrado"}
          </p>
          <button
            onClick={() => router.back()}
            className="mt-4 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <article className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <PostCard post={post} />

      <section id="comments-section" aria-labelledby="comments-heading">
        <CommentSection postId={post.id} />
      </section>

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        postId={post.id}
        title={`Publicacao de ${post.author.displayName ?? post.author.name}`}
      />
    </article>
  )
}
