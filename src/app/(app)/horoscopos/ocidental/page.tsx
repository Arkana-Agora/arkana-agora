"use client"

import { useState } from "react"

import { WesternHoroscopeCard } from "@/components/horoscopes/western-horoscope-card"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  useHoroscopes,
  useMyHoroscope,
  type HoroscopePeriod,
} from "@/hooks/use-horoscopes"
import { HOROSCOPE_PERIOD_LABELS } from "@/lib/horoscopes/prompts"
import { WESTERN_SIGNS } from "@/lib/horoscopes/western"

const PERIODS: Array<{ id: HoroscopePeriod; label: string }> = (
  ["daily", "weekly", "monthly"] as const
).map((id) => ({ id, label: HOROSCOPE_PERIOD_LABELS[id] }))

const COMPAT_LABELS: Array<{
  key: "love" | "friendship" | "work" | "overall"
  label: string
}> = [
  { key: "love", label: "Amor" },
  { key: "friendship", label: "Amizade" },
  { key: "work", label: "Carreira" },
  { key: "overall", label: "Geral" },
]

const DEFAULT_SIGN = "aries"

/**
 * Horóscopo Ocidental (T092/US-024): signo featured do perfil
 * (useMyHoroscope, fallback Áries + hint), seletor dos 12 signos, abas
 * diário/semanal/mensal e painel de compatibilidade T090 quando um signo
 * alvo é escolhido. Uma única query `useHoroscopes` por combinação.
 */
export default function WesternHoroscopePage() {
  const { data: myHoroscope, isLoading: myLoading } = useMyHoroscope()
  const [period, setPeriod] = useState<HoroscopePeriod>("daily")
  const [selectedSign, setSelectedSign] = useState<string | null>(null)
  const [targetSign, setTargetSign] = useState<string | null>(null)

  const effectiveSign =
    selectedSign ?? myHoroscope?.western?.signId ?? DEFAULT_SIGN

  // `enabled: !myLoading`: sem isso a página dispararia o GET de placeholder
  // Áries enquanto my-horoscope carrega e refetcharia o signo real em
  // seguida (request descartável + cache queryKey poluído — review julik).
  const { data, isLoading, isError } = useHoroscopes(
    "western",
    period,
    undefined,
    {
      sign: effectiveSign,
      targetSign: targetSign ?? undefined,
      enabled: !myLoading,
    },
  )

  const sign = WESTERN_SIGNS.find((s) => s.id === effectiveSign)
  const noBirthDate = !myLoading && myHoroscope && !myHoroscope.western

  const handleSelectSign = (signId: string): void => {
    setSelectedSign(signId)
    // targetSign igual ao signo selecionado ficaria "órfão" (o <select>
    // filtra a opção, mas o state continuaria mandando o GET com a matriz
    // de um signo consigo mesmo — review julik).
    setTargetSign((current) => (current === signId ? null : current))
  }

  return (
    <div className="space-y-6" data-testid="western-horoscope-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Horóscopo Ocidental</h1>
        <p className="text-sm text-muted-foreground">
          Escolha seu signo e o período para ler a leitura do dia.
        </p>
        {noBirthDate && (
          <p className="text-sm text-muted-foreground" data-testid="sign-hint">
            Mostrando {sign?.name ?? "Áries"} — adicione sua data de nascimento
            para ver seu signo automaticamente.
          </p>
        )}
      </header>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Selecionar signo"
      >
        {WESTERN_SIGNS.map((westernSign) => (
          <Button
            key={westernSign.id}
            type="button"
            size="sm"
            variant={westernSign.id === effectiveSign ? "default" : "outline"}
            aria-pressed={westernSign.id === effectiveSign}
            onClick={() => handleSelectSign(westernSign.id)}
          >
            {westernSign.emoji} {westernSign.name}
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

      <div className="flex items-center gap-2">
        <label htmlFor="compat-target" className="text-sm font-medium">
          Ver compatibilidade com
        </label>
        <select
          id="compat-target"
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={targetSign ?? ""}
          onChange={(event) =>
            setTargetSign(event.target.value === "" ? null : event.target.value)
          }
        >
          <option value="">Nenhum</option>
          {WESTERN_SIGNS.filter((s) => s.id !== effectiveSign).map((s) => (
            <option key={s.id} value={s.id}>
              {s.emoji} {s.name}
            </option>
          ))}
        </select>
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
          <WesternHoroscopeCard horoscope={data} />

          {data.compatibility && (
            <Card data-testid="compatibility-panel">
              <CardHeader>
                <CardTitle className="text-base">
                  Compatibilidade com{" "}
                  {
                    WESTERN_SIGNS.find(
                      (s) => s.id === data.compatibility?.targetSignId,
                    )?.name
                  }
                </CardTitle>
                <CardDescription>
                  Sua leitura atual ({sign?.name}) em relação a este signo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {COMPAT_LABELS.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium">
                      {data.compatibility?.[row.key]}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
