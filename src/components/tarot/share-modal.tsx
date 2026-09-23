"use client"

import { Button } from "@/components/ui/button"
import { AnimatePresence, motion } from "framer-motion"
import { Copy, Download, Share2, X } from "lucide-react"

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  readingId: string
  readingTitle?: string
  cards?: Array<{
    name: string
    imageUrl: string
    isReversed: boolean
  }>
}

export function ShareModal({
  isOpen,
  onClose,
  readingId,
  readingTitle,
}: ShareModalProps) {
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tiragem/${readingId}`
      : ""

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      // fallback
    }
  }

  const handleDownload = async () => {
    try {
      const { getSession } = await import("next-auth/react")
      const session = await getSession()
      const headers: Record<string, string> = {}
      if (session?.accessToken) {
        headers.Authorization = `Bearer ${session.accessToken}`
      }
      const response = await fetch(`/api/v1/readings/${readingId}/og-image`, {
        headers,
      })
      if (!response.ok) throw new Error("Falha ao gerar imagem")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `tiragem-${readingId}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // fallback
    }
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: readingTitle ?? `Tiragem de Tarot #${readingId}`,
          text: `Confira minha tiragem de Tarot no Arkana Agora`,
          url: shareUrl,
        })
      } catch {
        // user cancelled
      }
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
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
            className="fixed bottom-0 left-0 right-0 z-50 md:top-auto md:right-4 md:bottom-4 md:left-auto md:w-80"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
          >
            <div className="bg-background rounded-t-2xl md:rounded-tl-2xl md:rounded-tr-2xl shadow-xl border-t border-border p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 id="share-modal-title" className="text-lg font-semibold">
                  Compartilhar Tiragem
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Link da tiragem
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                      aria-label="Copiar link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleCopyLink}
                  >
                    <Copy className="h-4 w-4" />
                    <span>Copiar Link</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleDownload}
                  >
                    <Download className="h-4 w-4" />
                    <span>Baixar</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleNativeShare}
                  >
                    <Share2 className="h-4 w-4" />
                    <span>Compartilhar</span>
                  </Button>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground text-center">
                    A tiragem será acessível publicamente via link
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
