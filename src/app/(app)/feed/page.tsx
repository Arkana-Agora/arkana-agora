"use client"

import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"

import { PostCard } from "@/components/social/post-card"
import { PostComposer } from "@/components/social/post-composer"
import { Button } from "@/components/ui/button"
import { useFeed } from "@/hooks/use-feed"

/** Distância (px) de arrasto para disparar o pull-to-refresh. */
const PULL_THRESHOLD = 60

/**
 * Feed infinito (T061/US-022, S2-5): barras de criação rápida, sentinel
 * com IntersectionObserver para `fetchNextPage` (páginas de 10),
 * pull-to-refresh por touch, skeleton/estado vazio com CTA e estado de
 * erro com retry inline.
 *
 * Q27: pill "N novos posts" no topo — consome `pendingPosts`/`flushPending`
 * do `useFeed` (fila do bus `post:new`, T072); ao clicar, os posts pendentes
 * são inseridos no topo da primeira página com dedup por id.
 */
export default function FeedPage() {
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    pendingPosts,
    flushPending,
  } = useFeed()
  const [composerOpen, setComposerOpen] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const startY = useRef<number | null>(null)
  const [pullDistance, setPullDistance] = useState(0)

  const posts = data?.pages.flatMap((page) => page.posts) ?? []

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { rootMargin: "200px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (event.currentTarget.scrollTop <= 0) {
      startY.current = event.touches[0]?.clientY ?? null
    } else {
      startY.current = null
    }
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (startY.current === null) return
    const dy = (event.touches[0]?.clientY ?? 0) - startY.current
    setPullDistance(dy > 0 ? dy : 0)
  }

  function handleTouchEnd() {
    const shouldRefresh = pullDistance >= PULL_THRESHOLD
    startY.current = null
    setPullDistance(0)
    if (shouldRefresh) void refetch()
  }

  return (
    <main
      data-testid="feed-container"
      className="mx-auto w-full max-w-2xl px-4 py-6 space-y-4"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        onClick={() => setComposerOpen(true)}
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        O que voce quer compartilhar?
      </button>

      {pendingPosts.length > 0 && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={flushPending}
          data-testid="feed-pill"
          className="mx-auto block rounded-full border border-primary bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          {pendingPosts.length} novo{pendingPosts.length === 1 ? "" : "s"} post
          {pendingPosts.length === 1 ? "" : "s"}
        </motion.button>
      )}

      {/* erro com dados já carregados → banner inline, mantendo a lista */}
      {isError && data !== undefined && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center space-y-2"
        >
          <p className="text-sm">Nao foi possivel atualizar o feed.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {isLoading ? (
        <div
          data-testid="feed-skeleton"
          className="space-y-4"
          aria-label="Carregando feed"
        >
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-40 rounded-xl border border-border bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : isError && data === undefined ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center space-y-3"
        >
          <p>Nao foi possivel carregar o feed.</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Seu feed esta vazio. Compartilhe sua primeira tiragem ou pensamento
            com a comunidade.
          </p>
          <Button onClick={() => setComposerOpen(true)}>
            Criar publicacao
          </Button>
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
          {isFetchingNextPage && (
            <p className="text-center text-sm text-muted-foreground">
              Carregando mais posts...
            </p>
          )}
          {hasNextPage && (
            <div
              ref={sentinelRef}
              data-testid="feed-sentinel"
              aria-hidden="true"
            />
          )}
        </>
      )}

      <PostComposer
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
      />
    </main>
  )
}
