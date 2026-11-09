"use client"

import React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { GIFT_CATALOG, getGiftCost } from "@/lib/social/gifts"

interface GiftSelectorProps {
  isOpen: boolean
  onClose: () => void
  recipientId: string
  recipientName: string
  userVersosBalance: number
}

export function GiftSelector({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  userVersosBalance,
}: GiftSelectorProps) {
  const { data: session } = useSession()

  const [sendingGiftId, setSendingGiftId] = React.useState<string | null>(null)

  const handleSendGift = async (giftId: string) => {
    if (sendingGiftId) return

    const cost = getGiftCost(giftId)
    if (!cost || cost > userVersosBalance) {
      toast.error("Versos insuficientes para este presente")
      return
    }

    setSendingGiftId(giftId)

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (session?.accessToken) {
        headers.Authorization = `Bearer ${session.accessToken}`
      }

      const response = await fetch("/api/v1/social/gifts/send", {
        method: "POST",
        headers,
        body: JSON.stringify({ toUserId: recipientId, giftId }),
      })

      if (!response.ok) {
        const error = await response.json()
        if (error.error?.code === "INSUFFICIENT_VERSOS") {
          toast.error("Versos insuficientes")
        } else if (error.error?.code === "SELF_GIFT") {
          toast.error("Não pode enviar presente para si mesmo")
        } else if (error.error?.code === "RATE_LIMITED") {
          toast.error("Limite de presentes diários atingido")
        } else {
          toast.error("Erro ao enviar presente")
        }
        return
      }

      const gift = GIFT_CATALOG.find((g) => g.id === giftId)
      toast.success(`${gift?.name ?? giftId} enviado para ${recipientName}!`)
      onClose()
    } catch {
      toast.error("Erro de conexão ao enviar presente")
    } finally {
      setSendingGiftId(null)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            data-testid="gift-selector-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-0 left-0 right-0 z-50 md:top-auto md:right-4 md:bottom-4 md:left-auto md:w-96 md:max-h-[90vh] md:overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gift-selector-title"
          >
            <div className="bg-background rounded-t-2xl md:rounded-tl-2xl md:rounded-tr-2xl shadow-xl border-t border-border p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 id="gift-selector-title" className="text-lg font-semibold">
                  Enviar presente para {recipientName}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-muted rounded-lg flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Saldo de Versos
                </span>
                <span className="text-lg font-bold text-primary">
                  {userVersosBalance.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[50vh] md:max-h-[60vh] overflow-y-auto">
                {GIFT_CATALOG.map((gift) => {
                  const cost = gift.cost
                  const canAfford = cost <= userVersosBalance

                  return (
                    <button
                      key={gift.id}
                      onClick={() => handleSendGift(gift.id)}
                      disabled={!canAfford || sendingGiftId === gift.id}
                      className={`
                        relative p-4 rounded-xl border transition-all text-left
                        ${
                          canAfford
                            ? "bg-background hover:bg-muted/50 border-border"
                            : "bg-muted/50 border-muted-foreground/20 opacity-60 cursor-not-allowed"
                        }
                      `}
                      aria-label={`Enviar ${gift.name} (${cost} Versos)`}
                    >
                      <div className="text-3xl mb-2">{gift.emoji}</div>
                      <div className="font-medium">{gift.name}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {cost} Versos
                      </div>
                      {sendingGiftId === gift.id && (
                        <>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-xl"
                          >
                            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                          </motion.div>
                          <span className="relative z-10 text-sm font-medium text-primary">
                            Enviando...
                          </span>
                        </>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 text-center text-sm text-muted-foreground">
                <p>Presentes são debitados do seu saldo de Versos.</p>
                <p className="mt-1">Destinatários PLUS recebem 50% de volta!</p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
