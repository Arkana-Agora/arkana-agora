"use client"

import { useState } from "react"
import { Share2 } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CHINESE_ANIMALS } from "@/lib/horoscopes/chinese"
import type { Horoscope } from "@/hooks/use-horoscopes"
import {
  getHoroscopeSection,
  type HoroscopeSectionKey,
} from "@/lib/horoscopes/validation"

interface ChineseHoroscopeCardProps {
  horoscope: Horoscope
}

const PERIOD_LABELS: Record<Horoscope["period"], string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
}

const SECTIONS: Array<{ id: HoroscopeSectionKey; label: string }> = [
  { id: "love", label: "Amor" },
  { id: "career", label: "Carreira" },
  { id: "health", label: "Saúde" },
]

/**
 * ChineseHoroscopeCard (T104/US-024): apresentação do horóscopo
 * chinês — animal + elemento (ex.: "Cavalo de Metal"), período/data,
 * texto geral, seções colapsáveis Amor/Carreira/Saúde (estado local,
 * aria-expanded), número/cor da sorte, animal compatível (campo do
 * conteúdo T032/T034) e compartilhar (Web Share API com fallback
 * clipboard + toast).
 */
export function ChineseHoroscopeCard({ horoscope }: ChineseHoroscopeCardProps) {
  const [openSection, setOpenSection] = useState<HoroscopeSectionKey | null>(
    null,
  )
  const animal = CHINESE_ANIMALS.find((a) => a.id === horoscope.signId)
  const compatibleAnimal = CHINESE_ANIMALS.find(
    (a) => a.id === horoscope.content.compatibility,
  )

  const toggleSection = (id: HoroscopeSectionKey) => {
    setOpenSection((current) => (current === id ? null : id))
  }

  const handleShare = async () => {
    const text = `${animal?.name ?? horoscope.signId}: ${horoscope.content.general}`
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

  const displayName = animal
    ? `${animal.name} de ${(horoscope.element ?? "").charAt(0).toUpperCase() + (horoscope.element ?? "").slice(1)}`
    : horoscope.signId

  return (
    <Card data-testid="chinese-horoscope-card">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">{displayName}</CardTitle>
        <span className="text-sm text-muted-foreground">
          {PERIOD_LABELS[horoscope.period]} · {horoscope.date}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <p data-testid="horoscope-general" className="text-sm leading-relaxed">
          {horoscope.content.general}
        </p>

        <div className="space-y-1">
          {SECTIONS.map(({ id: sectionId, label }) => {
            const isOpen = openSection === sectionId
            return (
              <div key={sectionId} className="rounded-lg border border-border">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={label}
                  data-testid={`horoscope-section-${sectionId}`}
                  onClick={() => toggleSection(sectionId)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-secondary transition-colors"
                >
                  {label}
                  <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <p className="border-t border-border px-3 py-2 text-sm text-muted-foreground">
                    {getHoroscopeSection(horoscope.content, sectionId)}
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

        {compatibleAnimal && (
          <p className="text-sm text-muted-foreground">
            Compatível com{" "}
            <span className="font-medium text-foreground">
              {compatibleAnimal.name}
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
