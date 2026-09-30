/* eslint-disable react-hooks/set-state-in-effect -- reset on modal close is a legitimate pattern */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { X, RotateCcw } from "lucide-react"

import { FollowButton } from "@/components/social/follow-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useFollowList, type FollowListSide } from "@/hooks/use-social"

const EMPTY_BY_SIDE: Record<FollowListSide, string> = {
  followers: "Nenhum seguidor ainda",
  following: "Ainda não segue ninguém",
}

const TITLE_BY_SIDE: Record<FollowListSide, string> = {
  followers: "Seguidores",
  following: "Seguindo",
}

const SEARCH_DEBOUNCE_MS = 300

interface FollowListModalProps {
  open: boolean
  onClose: () => void
  username: string
  side: FollowListSide
  /** ID do usuário logado — usado para ocultar a própria linha na lista. */
  currentUserId?: string
}

function FollowListModal({
  open,
  onClose,
  username,
  side,
  currentUserId,
}: FollowListModalProps) {
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const dialogRef = useRef<HTMLDivElement>(null)

  const handleClose = useCallback(() => {
    setSearch("")
    setQuery("")
    onClose()
  }, [onClose])

  const resetSearch = useCallback(() => {
    setSearch("")
    setQuery("")
  }, [])

  // Reset busca ao fechar o modal (quando open muda de true para false)
  useEffect(() => {
    if (!open) {
      resetSearch()
    }
  }, [open, resetSearch])

  // Debounce da busca
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  // Escape para fechar + foco no input ao abrir
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    // Foco no input de busca ao abrir
    const input = dialogRef.current?.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )
    input?.focus()
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, handleClose])

  const list = useFollowList(username, side, query, open)

  const allItems = list.data?.pages.flatMap((page) => page.data) ?? []
  // Oculta a própria linha (self-row)
  const items = currentUserId
    ? allItems.filter((item) => item.userId !== currentUserId)
    : allItems

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={TITLE_BY_SIDE[side]}
        className="bg-background w-full max-w-md rounded-xl border border-border p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{TITLE_BY_SIDE[side]}</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 transition-colors hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label htmlFor={`follow-search-${side}`} className="sr-only">
          Buscar por nome
        </label>
        <input
          id={`follow-search-${side}`}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome"
          aria-label="Buscar por nome"
          maxLength={50}
          className="border-border bg-background mb-3 w-full rounded-lg border px-3 py-2 text-sm"
        />

        {list.isLoading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : list.isError ? (
          <div className="space-y-3" role="alert">
            <p className="text-sm text-destructive text-center">
              Não foi possível carregar a lista
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void list.refetch()}
              className="w-full gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            {EMPTY_BY_SIDE[side]}
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.userId}
                className="flex items-center gap-3 rounded-lg border border-border p-2"
              >
                <Avatar className="h-9 w-9">
                  {item.avatarUrl ? (
                    <AvatarImage src={item.avatarUrl} alt={item.name} />
                  ) : null}
                  <AvatarFallback>
                    {item.name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {item.username ?? ""}
                  </p>
                </div>
                <FollowButton
                  targetUserId={item.userId}
                  username={item.username ?? undefined}
                  initialFollowing={item.isFollowing ?? false}
                  size="sm"
                />
              </li>
            ))}
          </ul>
        )}

        {list.hasNextPage ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={() => void list.fetchNextPage()}
            disabled={list.isFetchingNextPage}
          >
            {list.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function FollowersModal(props: Omit<FollowListModalProps, "side">) {
  return <FollowListModal {...props} side="followers" />
}

export function FollowingModal(props: Omit<FollowListModalProps, "side">) {
  return <FollowListModal {...props} side="following" />
}
