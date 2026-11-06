"use client"

import { useState } from "react"
import { Share2 } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { WESTERN_SIGNS } from "@/lib/horoscopes/western"
import type { Horoscope } from "@/hooks/use-horoscopes"

interface WesternHoroscopeCardProps {
  horoscope: Horoscope
}

const PERIOD_LABELS: Record<Horoscope["period"], string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
}

interface SectionDef {
  id: "love" | "career" | "health"
  label: string
}

const SECTIONS: SectionDef[] = [
  { id: "love", label: "Amor" },
  { id: "career", label: "Carreira" },
  { id: "health", label: "Saúde" },
]

/**
 * WesternHoroscopeCard (T091/US-024): apresentação do horóscopo
 * ocidental — signo (emoji + nome), período/data, texto geral, seções
 * colapsáveis Amor/Carreira/Saúde (estado local, aria-expanded),
 * número/cor da sorte, signo compatível (campo do conteúdo T032/T034) e
 * compartilhar (Web Share API com fallback clipboard + toast).
 */
export function WesternHoroscopeCard({ horoscope }: WesternHoroscopeCardProps) {
  const [openSection, setOpenSection] = useState<SectionDef["id"] | null>(null)
  const sign = WESTERN_SIGNS.find((s) => s.id === horoscope.signId)
  const compatible = WESTERN_SIGNS.find(
    (s) => s.id === horoscope.content.compatibility,
  )

  const toggleSection = (id: SectionDef["id"]) => {
    setOpenSection((current) => (current === id ? null : id))
  }

  const handleShare = async () => {
    const text = `${sign?.name ?? horoscope.signId}: ${horoscope.content.general}`
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Horóscopo no Arkana Agora", text })
      } catch {
        // usuário cancelou o share nativo
      }
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Horóscopo copiado para a área de transferência")
    } catch {
      toast.error("Não foi possível copiar o horóscopo")
    }
  }

  return (
    <Card data-testid="western-horoscope-card">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">
          {sign ? `${sign.emoji} ${sign.name}` : horoscope.signId}
        </CardTitle>
        <span className="text-sm text-muted-foreground">
          {PERIOD_LABELS[horoscope.period]} · {horoscope.date}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <p data-testid="horoscope-general" className="text-sm leading-relaxed">
          {horoscope.content.general}
        </p>

        <div className="space-y-1">
          {SECTIONS.map((section) => {
            const isOpen = openSection === section.id
            return (
              <div key={section.id} className="rounded-lg border border-border">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={section.label}
                  data-testid={`horoscope-section-${section.id}`}
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-secondary transition-colors"
                >
                  {section.label}
                  <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <p className="border-t border-border px-3 py-2 text-sm text-muted-foreground">
                    {horoscope.content[section.id]}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between rounded-lg bg-muted px-3 py-2">
            <span className="text-muted-foreground">Número da sorte</span>
            <span className="font-medium">{horoscope.content.luckyNumber}</span>
          </div>
          <div className="flex justify-between rounded-lg bg-muted px-3 py-2">
            <span className="text-muted-foreground">Cor da sorte</span>
            <span className="font-medium">{horoscope.content.luckyColor}</span>
          </div>
        </div>

        {compatible && (
          <p className="text-sm text-muted-foreground">
            Compatível com{" "}
            <span className="font-medium text-foreground">
              {compatible.emoji} {compatible.name}
            </span>
          </p>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          data-testid="share-horoscope"
          onClick={() => void handleShare()}
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Compartilhar
        </Button>
      </CardContent>
    </Card>
  )
}
