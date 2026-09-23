"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useMyProfile, useUpdatePrivacy } from "@/hooks/use-profile"
import type { PrivacyData } from "@/hooks/use-profile"

function toSettings(privacy: PrivacyData | null | undefined): PrivacyData {
  if (!privacy) return {}
  const p = privacy
  return {
    ...(p.profileVisibility != null && {
      profileVisibility: p.profileVisibility,
    }),
    ...(p.statsVisibility != null && { statsVisibility: p.statsVisibility }),
    ...(p.arcanaVisibility != null && {
      arcanaVisibility: p.arcanaVisibility,
    }),
    ...(p.whoCanFollow != null && { whoCanFollow: p.whoCanFollow }),
    ...(p.whoCanComment != null && { whoCanComment: p.whoCanComment }),
  }
}

export function PrivacySettings() {
  const { data: profile, isLoading } = useMyProfile()
  const updatePrivacy = useUpdatePrivacy()
  const [localSettings, setLocalSettings] = useState<PrivacyData | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const settings =
    isDirty && localSettings ? localSettings : toSettings(profile?.privacy)

  const updateSetting = <K extends keyof PrivacyData>(
    key: K,
    value: PrivacyData[K],
  ) => {
    setIsDirty(true)
    setSubmitError(null)
    setSavedAt(null)
    setLocalSettings({ ...settings, [key]: value })
  }

  const handleSave = async () => {
    setSubmitError(null)
    try {
      await updatePrivacy.mutateAsync(settings)
      setIsDirty(false)
      setLocalSettings(null)
      setSavedAt(new Date().toLocaleTimeString("pt-BR"))
    } catch {
      setSubmitError("Não foi possível salvar. Tente novamente.")
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor="privacy-profile-visibility">
          Visibilidade do perfil
        </Label>
        <select
          id="privacy-profile-visibility"
          value={settings.profileVisibility ?? "public"}
          onChange={(e) =>
            updateSetting(
              "profileVisibility",
              e.target.value as "public" | "private",
            )
          }
          className="w-full border rounded-md p-2"
        >
          <option value="public">Público</option>
          <option value="private">Privado</option>
        </select>
      </div>

      <div className="space-y-3">
        <Label htmlFor="privacy-stats-visibility">
          Visibilidade das estatísticas
        </Label>
        <select
          id="privacy-stats-visibility"
          value={settings.statsVisibility ?? "public"}
          onChange={(e) =>
            updateSetting(
              "statsVisibility",
              e.target.value as "public" | "private",
            )
          }
          className="w-full border rounded-md p-2"
        >
          <option value="public">Público</option>
          <option value="private">Privado</option>
        </select>
      </div>

      <div className="space-y-3">
        <Label htmlFor="privacy-arcana-visibility">
          Visibilidade do arcano pessoal
        </Label>
        <select
          id="privacy-arcana-visibility"
          value={settings.arcanaVisibility ?? "public"}
          onChange={(e) =>
            updateSetting(
              "arcanaVisibility",
              e.target.value as "public" | "private",
            )
          }
          className="w-full border rounded-md p-2"
        >
          <option value="public">Público</option>
          <option value="private">Privado</option>
        </select>
      </div>

      <div className="space-y-3">
        <Label htmlFor="privacy-who-can-follow">Quem pode me seguir</Label>
        <select
          id="privacy-who-can-follow"
          value={settings.whoCanFollow ?? "all"}
          onChange={(e) =>
            updateSetting(
              "whoCanFollow",
              e.target.value as "all" | "following" | "nobody",
            )
          }
          className="w-full border rounded-md p-2"
        >
          <option value="all">Todos</option>
          <option value="following">Quem eu sigo</option>
          <option value="nobody">Ninguém</option>
        </select>
      </div>

      <div className="space-y-3">
        <Label htmlFor="privacy-who-can-comment">Quem pode comentar</Label>
        <select
          id="privacy-who-can-comment"
          value={settings.whoCanComment ?? "all"}
          onChange={(e) =>
            updateSetting(
              "whoCanComment",
              e.target.value as "all" | "following" | "nobody",
            )
          }
          className="w-full border rounded-md p-2"
        >
          <option value="all">Todos</option>
          <option value="following">Quem eu sigo</option>
          <option value="nobody">Ninguém</option>
        </select>
      </div>

      <Button
        onClick={() => void handleSave()}
        disabled={updatePrivacy.isPending}
      >
        {updatePrivacy.isPending ? "Salvando..." : "Salvar privacidade"}
      </Button>

      {submitError && (
        <p className="text-sm text-destructive" role="alert">
          {submitError}
        </p>
      )}

      {savedAt && !submitError && (
        <p
          className="text-xs text-muted-foreground"
          data-testid="privacy-saved"
        >
          Privacidade salva às {savedAt}
        </p>
      )}
    </div>
  )
}
