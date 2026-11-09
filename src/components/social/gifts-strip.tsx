"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { GiftSelector } from "@/components/social/gift-selector"
import { getGiftById } from "@/lib/social/gifts"
import { useSocket } from "@/hooks/use-socket"
import { toast } from "sonner"
import { useSession } from "next-auth/react"

interface GiftReceived {
  id: string
  giftId: string
  coinCost: number
  recipientEarnsHalf: boolean
  createdAt: string
  fromUser: {
    id: string
    name: string
    avatar: string | null
  }
}

interface GiftsReceivedResponse {
  gifts: GiftReceived[]
  totalReceived: number
}

interface GiftsStripProps {
  userId: string
  onSendGift?: (fromUserId: string) => void
}

export function GiftsStrip({ userId, onSendGift }: GiftsStripProps) {
  const { data: session } = useSession()
  const [gifts, setGifts] = useState<GiftReceived[]>([])
  const [totalReceived, setTotalReceived] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState<{
    id: string
    name: string
  } | null>(null)
  const [userVersosBalance, setUserVersosBalance] = useState(0)
  const loadGifts = useCallback(async () => {
    try {
      setIsLoading(true)
      const authHeader = session?.accessToken
        ? `Bearer ${session.accessToken}`
        : ""
      const res = await fetch(
        `/api/v1/social/gifts/received?userId=${userId}`,
        {
          headers: { Authorization: authHeader },
        },
      )
      if (!res.ok) throw new Error("Falha ao carregar presentes")
      const data: GiftsReceivedResponse = await res.json()
      setGifts(data.gifts)
      setTotalReceived(data.totalReceived)
    } catch {
      setError("Falha ao carregar presentes recebidos")
    } finally {
      setIsLoading(false)
    }
  }, [userId, session])

  const loadBalance = useCallback(async () => {
    if (!session?.accessToken) return
    try {
      const res = await fetch("/api/v1/social/versos/balance", {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUserVersosBalance(data.balance ?? 0)
      }
    } catch {
      // ignore
    }
  }, [session])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGifts()
  }, [loadGifts])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBalance()
  }, [loadBalance])

  // Escutar evento realtime de presente recebido via useSocket handlers
  const handleGiftReceived = useCallback(
    (data: {
      giftId: string
      fromUserId: string
      toUserId: string
      giftName: string
    }) => {
      if (data.toUserId === userId) {
        loadGifts()
        toast.success(`Você recebeu um ${data.giftName}!`)
      }
    },
    [userId, loadGifts],
  )

  useSocket({
    "gift-received": handleGiftReceived,
  })
  const handleOpenSelector = (recipient: { id: string; name: string }) => {
    setSelectedRecipient(recipient)
    setIsSelectorOpen(true)
  }

  const handleSelectorClose = async () => {
    setIsSelectorOpen(false)
    setSelectedRecipient(null)
    await Promise.all([loadGifts(), loadBalance()])
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
        <span>Carregando presentes...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        <p>{error}</p>
        <button
          onClick={loadGifts}
          className="mt-2 text-sm text-primary hover:underline"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (gifts.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Nenhum presente recebido ainda</p>
        {onSendGift && (
          <button
            onClick={() => onSendGift(userId)}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Enviar o primeiro presente
          </button>
        )}
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Presentes Recebidos</h2>
        <span className="text-sm text-muted-foreground">
          Total: {totalReceived}
        </span>
      </div>

      <div className="space-y-3">
        {gifts.map((gift) => {
          const giftInfo = getGiftById(gift.giftId)
          return (
            <div
              key={gift.id}
              className="flex items-center gap-4 p-4 bg-card rounded-xl border animate-slide-in"
            >
              <div className="text-3xl">{giftInfo?.emoji ?? "🎁"}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{giftInfo?.name ?? gift.giftId}</p>
                <p className="text-sm text-muted-foreground truncate">
                  De {gift.fromUser.name} • {gift.coinCost} Versos
                  {gift.recipientEarnsHalf && (
                    <span className="ml-2 text-xs text-green-600">
                      +50% bônus PLUS
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(gift.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenSelector(gift.fromUser)}
                className="flex-shrink-0"
              >
                Retribuir
              </Button>
            </div>
          )
        })}
      </div>

      <GiftSelector
        isOpen={isSelectorOpen}
        onClose={handleSelectorClose}
        recipientId={selectedRecipient?.id ?? ""}
        recipientName={selectedRecipient?.name ?? ""}
        userVersosBalance={userVersosBalance}
      />
    </section>
  )
}
