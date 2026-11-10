"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  type HoroscopeNotificationSettings,
  useHoroscopeNotificationSettings,
  useSaveHoroscopeNotificationSettings,
} from "@/hooks/use-horoscopes"

const TOGGLE_FIELDS: Array<{
  key: "westernEnabled" | "chineseEnabled" | "mayaEnabled"
  label: string
}> = [
  { key: "westernEnabled", label: "Horóscopo ocidental" },
  { key: "chineseEnabled", label: "Horóscopo chinês" },
  { key: "mayaEnabled", label: "Horóscopo maia" },
]

interface SettingsFormProps {
  settings: HoroscopeNotificationSettings
}

function SettingsForm({ settings }: SettingsFormProps) {
  const save = useSaveHoroscopeNotificationSettings()
  const [form, setForm] = useState<HoroscopeNotificationSettings>(settings)

  const handleSave = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    save.mutate(form, {
      onSuccess: () => toast.success("Preferências de notificação salvas"),
      onError: () => toast.error("Não foi possível salvar as preferências"),
    })
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-2">
        {TOGGLE_FIELDS.map((field) => (
          <label
            key={field.key}
            className="flex items-center gap-2 text-sm font-medium"
          >
            <Input
              type="checkbox"
              className="h-4 w-4"
              checked={form[field.key]}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  [field.key]: event.target.checked,
                }))
              }
            />
            {field.label}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="notification-hour" className="text-sm">
          Horário
        </Label>
        <Input
          id="notification-hour"
          type="number"
          min={0}
          max={23}
          className="w-20"
          value={form.hour}
          onChange={(event) => {
            // Number("") === 0 viraria meia-noite silencioso; ignora input
            // vazio/não inteiro/fora de 0–23 até virar válido.
            const raw = event.target.value
            if (raw === "") return
            const hour = Number(raw)
            if (!Number.isInteger(hour) || hour < 0 || hour > 23) return
            setForm((current) => ({ ...current, hour }))
          }}
        />
      </div>

      <Button type="submit" size="sm" disabled={save.isPending}>
        {save.isPending ? "Salvando…" : "Salvar preferências"}
      </Button>
    </form>
  )
}

/**
 * Seção de notificações de horóscopo (T103/RF-HORO-008): três toggles de
 * sistema + hora local (0–23), PATCH no salvar. O form é montado com
 * `key` estável por conteúdo — trocas reais do GET (invalidação pós-save)
 * remontam com os dados novos, sem efeito de setState. Primitivas do
 * design system (checkbox nativo + input de hora, sem switch/tabs).
 *
 * Erro do GET só vira tela de erro quando NÃO há settings em cache
 * (React Query mantém `data` em refetch com erro — mostrar o form com um
 * alerta inline aproveita o cache em vez de descartar a tela).
 */
export function NotificationSettings() {
  const {
    data: settings,
    isLoading,
    isError,
  } = useHoroscopeNotificationSettings()

  if (isError && settings === undefined) {
    return (
      <Card data-testid="notification-settings">
        <CardHeader>
          <CardTitle className="text-base">Notificações de horóscopo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar suas preferências.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-testid="notification-settings">
      <CardHeader>
        <CardTitle className="text-base">Notificações de horóscopo</CardTitle>
        <CardDescription>
          Escolha quais signos você quer receber e em qual horário (hora de
          Brasília).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError && settings !== undefined ? (
          <Alert>
            <AlertDescription>
              Não foi possível recarregar suas preferências — exibindo os
              últimos valores salvos.
            </AlertDescription>
          </Alert>
        ) : null}
        {isLoading || !settings ? (
          <p className="text-sm text-muted-foreground" role="status">
            Carregando…
          </p>
        ) : (
          <SettingsForm key={JSON.stringify(settings)} settings={settings} />
        )}
      </CardContent>
    </Card>
  )
}
