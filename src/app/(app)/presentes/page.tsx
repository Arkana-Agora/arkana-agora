"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { GiftSelector } from "@/components/social/gift-selector"
import { GIFT_CATALOG, getGiftById } from "@/lib/social/gifts"
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

interface VersosBalanceResponse {
  balance: number
  streak: number
  lastClaimAt: string | null
  dailyEarned: number
}

export default function GiftsPage() {
  const { data: session } = useSession()
  const [balance, setBalance] = useState<VersosBalanceResponse | null>(null)
  const [receivedGifts, setReceivedGifts] =
    useState<GiftsReceivedResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState<{
    id: string
    name: string
  } | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [balanceRes, giftsRes] = await Promise.all([
          fetch("/api/v1/social/versos/balance", {
            headers: { Authorization: `Bearer ${session?.accessToken}` },
          }),
          fetch("/api/v1/social/gifts/received", {
            headers: { Authorization: `Bearer ${session?.accessToken}` },
          }),
        ])

        if (!balanceRes.ok) {
          throw new Error("Erro ao carregar saldo")
        }
        if (!giftsRes.ok) {
          throw new Error("Erro ao carregar presentes recebidos")
        }

        setBalance(await balanceRes.json())
        setReceivedGifts(await giftsRes.json())
      } catch {
        toast.error("Erro ao carregar dados de presentes")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [session?.accessToken])

  const handleOpenSelector = (recipient: { id: string; name: string }) => {
    setSelectedRecipient(recipient)
    setIsSelectorOpen(true)
  }

  const handleSelectorClose = async () => {
    setIsSelectorOpen(false)
    setSelectedRecipient(null)
    if (balance) {
      try {
        const balanceRes = await fetch("/api/v1/social/versos/balance", {
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        })
        if (balanceRes.ok) {
          setBalance(await balanceRes.json())
        }
        const giftsRes = await fetch("/api/v1/social/gifts/received", {
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        })
        if (giftsRes.ok) {
          setReceivedGifts(await giftsRes.json())
        }
      } catch {
        // Ignore errors on refresh
      }
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          <span className="sr-only">Carregando...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Presentes</h1>
        <p className="text-muted-foreground mt-1">
          Envie presentes mágicos para seus amigos e acompanhe seu saldo de
          Versos
        </p>
      </div>

      {/* Saldo de Versos */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Seu Saldo de Versos</h2>
              <p className="text-3xl font-bold text-primary mt-1">
                {balance?.balance.toLocaleString() ?? 0} Versos
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Streak de claim diário: {balance?.streak ?? 0} dias
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                handleOpenSelector({ id: "usr_self", name: "Você" })
              }
              disabled={!balance || (balance?.balance ?? 0) < 10}
            >
              Comprar Versos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Catálogo de Presentes */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Catálogo de Presentes</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {GIFT_CATALOG.map((gift) => {
            const cost = gift.cost
            const canAfford = balance && balance.balance >= cost

            return (
              <Card key={gift.id} className={!canAfford ? "opacity-60" : ""}>
                <CardContent className="p-6">
                  <div className="text-4xl mb-2 text-center">{gift.emoji}</div>
                  <h3 className="font-semibold text-center mb-1">
                    {gift.name}
                  </h3>
                  <p className="text-sm text-muted-foreground text-center mb-3">
                    {cost} Versos
                  </p>
                  <Button
                    className="w-full"
                    variant={canAfford ? "default" : "outline"}
                    onClick={() =>
                      handleOpenSelector({ id: "usr_self", name: "Você" })
                    }
                    disabled={!canAfford}
                  >
                    Enviar
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Histórico de Presentes Recebidos */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Presentes Recebidos</h2>
          <span className="text-sm text-muted-foreground">
            Total: {receivedGifts?.totalReceived ?? 0}
          </span>
        </div>
        <div className="space-y-3">
          {receivedGifts?.gifts?.length === 0 ? (
            <Card>
              <CardContent className="pt-6 pb-6 text-center">
                <p className="text-muted-foreground">
                  Nenhum presente recebido ainda
                </p>
              </CardContent>
            </Card>
          ) : (
            receivedGifts?.gifts?.map((gift) => {
              const giftInfo = getGiftById(gift.giftId)
              return (
                <Card key={gift.id} className="flex items-center gap-4 p-4">
                  <div className="text-3xl">{giftInfo?.emoji ?? "🎁"}</div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {giftInfo?.name ?? gift.giftId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      De {gift.fromUser.name} • {gift.coinCost} Versos
                      {gift.recipientEarnsHalf && " • +50% bônus PLUS"}
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
                  >
                    Retribuir
                  </Button>
                </Card>
              )
            })
          )}
        </div>
      </section>

      {/* Gift Selector Modal */}
      <GiftSelector
        isOpen={isSelectorOpen}
        onClose={handleSelectorClose}
        recipientId={selectedRecipient?.id ?? ""}
        recipientName={selectedRecipient?.name ?? ""}
        userVersosBalance={balance?.balance ?? 0}
      />
    </div>
  )
}
