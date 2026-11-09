"use client"

import { useState } from "react"
import { Share2 } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  MAYAN_SEALS,
  MAYAN_TONES,
  getMayanOndaEncantada,
} from "@/lib/horoscopes/maya"
import type { Horoscope } from "@/hooks/use-horoscopes"
import {
  getHoroscopeSection,
  type HoroscopeSectionKey,
} from "@/lib/horoscopes/validation"

interface MayanHoroscopeCardProps {
  horoscope: Horoscope
}

const PERIOD_LABELS: Record<Horoscope["period"], string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
}

const OPPOSITE_KIN_OFFSET = 64 // Tzolkin opposite kin offset (mod 260)

const SECTIONS: Array<{ id: HoroscopeSectionKey; label: string }> = [
  { id: "love", label: "Amor" },
  { id: "career", label: "Carreira" },
  { id: "health", label: "Saúde" },
]

/**
 * MayanHoroscopeCard (T111/US-025): apresentação do horóscopo
 * Maia — Kin + Selo + Tom, Onda Encantada (9 câmaras), período/data,
 * texto geral, seções colapsáveis Amor/Carreira/Saúde (estado local,
 * aria-expanded), número/cor da sorte, compatibilidade (kin oposto na
 * roda Tzolkin) e compartilhar (Web Share API com fallback
 * clipboard + toast).
 */
export function MayanHoroscopeCard({ horoscope }: MayanHoroscopeCardProps) {
  const [openSection, setOpenSection] = useState<HoroscopeSectionKey | null>(
    null,
  )
  const kinNumber = horoscope.kin?.number ?? Number(horoscope.signId)
  const kinSealIndex = horoscope.kin?.seal ?? Number(horoscope.signId) % 20
  const kinToneIndex = (horoscope.kin?.tone ?? ((kinNumber - 1) % 13) + 1) - 1

  const seal = MAYAN_SEALS[kinSealIndex]
  const tone = MAYAN_TONES[kinToneIndex]
  const onda = getMayanOndaEncantada(kinNumber)
  const compatibleKin = ((kinNumber + OPPOSITE_KIN_OFFSET) % 260) + 1
  const compatibleSeal = MAYAN_SEALS[compatibleKin % 20]

  const toggleSection = (id: HoroscopeSectionKey) => {
    setOpenSection((current) => (current === id ? null : id))
  }

  const handleShare = async () => {
    const text = `Kin ${kinNumber} (${seal?.name ?? ""} ${tone?.name ?? ""}): ${horoscope.content.general}`
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Horóscopo Maia no Arkana Agora", text })
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

  const displayName =
    seal && tone
      ? `Kin ${kinNumber} — ${seal.name} ${tone.name}`
      : `Kin ${kinNumber}`

  return (
    <Card data-testid="mayan-horoscope-card">
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

        {seal && tone && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between rounded-lg bg-muted px-3 py-2">
              <span className="text-muted-foreground">Selo</span>
              <span className="font-medium">
                {seal.name} ({seal.color})
              </span>
            </div>
            <div className="flex justify-between rounded-lg bg-muted px-3 py-2">
              <span className="text-muted-foreground">Tom</span>
              <span className="font-medium">
                {tone.name} — {tone.keyword}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex justify-between rounded-lg bg-muted px-3 py-2">
            <span className="text-muted-foreground">Onda Encantada</span>
            <span className="font-medium">
              {onda.waveSeal.name} (câmaras 1-9)
            </span>
          </div>
          <div className="flex justify-between rounded-lg bg-muted px-3 py-2">
            <span className="text-muted-foreground">Kin compatível</span>
            <span className="font-medium">
              {compatibleSeal?.name ?? `Kin ${compatibleKin}`}
            </span>
          </div>
        </div>

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
