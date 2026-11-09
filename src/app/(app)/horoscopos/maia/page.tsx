"use client"

import { useState } from "react"

import { MayanHoroscopeCard } from "@/components/horoscopes/mayan-horoscope-card"
import { Button } from "@/components/ui/button"

import {
  useHoroscopes,
  useMyHoroscope,
  type HoroscopePeriod,
} from "@/hooks/use-horoscopes"
import { HOROSCOPE_PERIOD_LABELS } from "@/lib/horoscopes/prompts"
import {
  MAYAN_KIN_COUNT,
  kinToSealTone,
  MAYAN_SEALS,
  MAYAN_TONES,
} from "@/lib/horoscopes/maya"

const PERIODS: Array<{ id: HoroscopePeriod; label: string }> = (
  ["daily", "weekly", "monthly"] as const
).map((id) => ({ id, label: HOROSCOPE_PERIOD_LABELS[id] }))

const DEFAULT_KIN = 1

/**
 * Horóscopo Maia (T112/US-025): Kin em destaque do perfil
 * (useMyHoroscope, fallback Kin 1 + hint), seletor de 260 kins,
 * abas diário/semanal/mensal e painel da Onda Encantada 9 câmaras.
 */
export default function MayanHoroscopePage() {
  const { data: myHoroscope, isLoading: myLoading } = useMyHoroscope()
  const [period, setPeriod] = useState<HoroscopePeriod>("daily")
  const [selectedKin, setSelectedKin] = useState<number | null>(null)

  const effectiveKin =
    selectedKin ?? myHoroscope?.mayan?.kin?.number ?? DEFAULT_KIN

  const { data, isLoading, isError } = useHoroscopes(
    "maya",
    period,
    undefined,
    {
      sign: String(effectiveKin),
      enabled: !myLoading,
    },
  )

  const kinSealTone = kinToSealTone(effectiveKin)
  const seal = MAYAN_SEALS[kinSealTone.sealIndex]
  const tone = MAYAN_TONES[kinSealTone.toneId - 1]
  const noBirthDate = !myLoading && myHoroscope && !myHoroscope.mayan

  const handleSelectKin = (kin: number): void => {
    setSelectedKin(kin)
  }

  return (
    <div className="space-y-6" data-testid="mayan-horoscope-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Horóscopo Maia</h1>
        <p className="text-sm text-muted-foreground">
          Escolha seu Kin e o período para ler a leitura do dia.
        </p>
        {noBirthDate && seal && tone && (
          <p className="text-sm text-muted-foreground" data-testid="kin-hint">
            Mostrando Kin {effectiveKin} ({seal.name} {tone.name}) — adicione
            sua data de nascimento para ver seu Kin automaticamente.
          </p>
        )}
      </header>

      <div
        className="flex flex-wrap gap-2 max-h-60 overflow-y-auto"
        role="group"
        aria-label="Selecionar Kin"
      >
        {Array.from({ length: MAYAN_KIN_COUNT }, (_, i) => i + 1).map((kin) => {
          const kinSealTone = kinToSealTone(kin)
          const seal = MAYAN_SEALS[kinSealTone.sealIndex]
          return (
            <Button
              key={kin}
              type="button"
              size="sm"
              variant={kin === effectiveKin ? "default" : "outline"}
              aria-pressed={kin === effectiveKin}
              onClick={() => handleSelectKin(kin)}
              className="min-w-[80px]"
              title={seal ? `${seal.name}` : `Kin ${kin}`}
            >
              {kin}
            </Button>
          )
        })}
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Período"
      >
        {PERIODS.map((periodOption) => (
          <Button
            key={periodOption.id}
            type="button"
            size="sm"
            variant={periodOption.id === period ? "default" : "outline"}
            aria-pressed={periodOption.id === period}
            onClick={() => setPeriod(periodOption.id)}
          >
            {periodOption.label}
          </Button>
        ))}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground" role="status">
          Carregando horóscopo…
        </p>
      )}
      {isError && (
        <p className="text-sm text-destructive" role="alert">
          Não foi possível carregar o horóscopo. Tente novamente.
        </p>
      )}

      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          <MayanHoroscopeCard horoscope={data} />
        </div>
      )}
    </div>
  )
}
