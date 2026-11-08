"use client"

import { useState } from "react"

import { ChineseHoroscopeCard } from "@/components/horoscopes/chinese-horoscope-card"
import { Button } from "@/components/ui/button"

import {
  useHoroscopes,
  useMyHoroscope,
  type HoroscopePeriod,
} from "@/hooks/use-horoscopes"
import { HOROSCOPE_PERIOD_LABELS } from "@/lib/horoscopes/prompts"
import { CHINESE_ANIMALS } from "@/lib/horoscopes/chinese"

const PERIODS: Array<{ id: HoroscopePeriod; label: string }> = (
  ["daily", "weekly", "monthly"] as const
).map((id) => ({ id, label: HOROSCOPE_PERIOD_LABELS[id] }))

const DEFAULT_ANIMAL = "rato"

/**
 * Horóscopo Chinês (T105/US-024): animal + elemento em destaque do
 * perfil (useMyHoroscope, fallback Rato + hint), seletor dos 12 animais,
 * abas diário/semanal/mensal.
 */
export default function ChineseHoroscopePage() {
  const { data: myHoroscope, isLoading: myLoading } = useMyHoroscope()
  const [period, setPeriod] = useState<HoroscopePeriod>("daily")
  const [selectedAnimal, setSelectedAnimal] = useState<string | null>(null)

  const effectiveAnimal =
    selectedAnimal ?? myHoroscope?.chinese?.signId ?? DEFAULT_ANIMAL

  const { data, isLoading, isError } = useHoroscopes(
    "chinese",
    period,
    undefined,
    {
      sign: effectiveAnimal,
      enabled: !myLoading,
    },
  )

  const animal = CHINESE_ANIMALS.find((a) => a.id === effectiveAnimal)
  const noBirthDate = !myLoading && myHoroscope && !myHoroscope.chinese

  const handleSelectAnimal = (animalId: string): void => {
    setSelectedAnimal(animalId)
  }

  return (
    <div className="space-y-6" data-testid="chinese-horoscope-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Horóscopo Chinês</h1>
        <p className="text-sm text-muted-foreground">
          Escolha seu animal e o período para ler a leitura do dia.
        </p>
        {noBirthDate && (
          <p
            className="text-sm text-muted-foreground"
            data-testid="animal-hint"
          >
            Mostrando {animal?.name ?? "Rato"} — adicione sua data de nascimento
            para ver seu animal automaticamente.
          </p>
        )}
      </header>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Selecionar animal"
      >
        {CHINESE_ANIMALS.map((chineseAnimal) => (
          <Button
            key={chineseAnimal.id}
            type="button"
            size="sm"
            variant={
              chineseAnimal.id === effectiveAnimal ? "default" : "outline"
            }
            aria-pressed={chineseAnimal.id === effectiveAnimal}
            onClick={() => handleSelectAnimal(chineseAnimal.id)}
          >
            {chineseAnimal.name}
          </Button>
        ))}
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
          <ChineseHoroscopeCard horoscope={data} />
        </div>
      )}
    </div>
  )
}
