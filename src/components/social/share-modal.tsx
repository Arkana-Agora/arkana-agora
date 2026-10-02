"use client"

import { Button } from "@/components/ui/button"
import { AnimatePresence, motion } from "framer-motion"
import { Copy, Download, Share2, X } from "lucide-react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  postId: string
  title?: string
}

/**
 * Modal de compartilhamento de post (T063/US-021): copiar link, baixar
 * PNG (og-image do post), Web Share API e links sociais. Mesmo padrão
 * visual do ShareModal de tiragens (`src/components/tarot/share-modal.tsx`).
 *
 * URL canônica: `/post/:id` (PostDetailPage, T131). O download usa a
 * `GET /social/posts/:id/og-image` (T058) com Bearer opcional — posts
 * públicos funcionam sem sessão; posts gated retornam 404 para não
 * seguidores (S2-15/CHK005).
 */
export function ShareModal({
  isOpen,
  onClose,
  postId,
  title,
}: ShareModalProps) {
  // single-flight: `useSession` compartilha a mesma sessão via SWR em vez
  // de disparar um `getSession()` (roundtrip) por clique em "Baixar"
  const { data: session } = useSession()

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/post/${postId}`
      : ""
  const encodedUrl = encodeURIComponent(shareUrl)

  const socialLinks = [
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}`,
    },
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedUrl}`,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
  ]

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      toast.error("Nao foi possivel copiar o link")
    }
  }

  const handleDownload = async () => {
    try {
      const headers: Record<string, string> = {}
      if (session?.accessToken) {
        headers.Authorization = `Bearer ${session.accessToken}`
      }
      const response = await fetch(`/api/v1/social/posts/${postId}/og-image`, {
        headers,
      })
      if (!response.ok) throw new Error("Falha ao gerar imagem")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `post-${postId}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Nao foi possivel baixar a imagem")
    }
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title ?? "Publicacao no Arkana Agora",
          url: shareUrl,
        })
      } catch {
        // usuario cancelou
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
                  Compartilhar publicacao
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
                  <label
                    htmlFor="share-post-link"
                    className="block text-sm font-medium text-muted-foreground mb-2"
                  >
                    Link da publicacao
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="share-post-link"
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

                <div className="pt-2 border-t flex gap-2 justify-center">
                  {socialLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={`Compartilhar no ${link.label}`}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
