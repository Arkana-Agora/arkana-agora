"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useMyProfile, useUpdatePrivacy } from "@/hooks/use-profile"
import type { PrivacyData } from "@/hooks/use-profile"

export function PrivacySettings() {
  const { data: profile, isLoading } = useMyProfile()
  const updatePrivacy = useUpdatePrivacy()

  const defaultSettings = useMemo<PrivacyData>(() => {
    if (!profile?.privacy) return {}
    const p = profile.privacy
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
  }, [profile?.privacy])

  const [settings, setSettings] = useState<PrivacyData>(defaultSettings)

  const handleSave = async () => {
    await updatePrivacy.mutateAsync(settings)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Visibilidade do perfil</Label>
        <select
          value={settings.profileVisibility ?? "public"}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              profileVisibility: e.target.value as "public" | "private",
            }))
          }
          className="w-full border rounded-md p-2"
        >
          <option value="public">Público</option>
          <option value="private">Privado</option>
        </select>
      </div>

      <div className="space-y-3">
        <Label>Quem pode me seguir</Label>
        <select
          value={settings.whoCanFollow ?? "all"}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              whoCanFollow: e.target.value as "all" | "following" | "nobody",
            }))
          }
          className="w-full border rounded-md p-2"
        >
          <option value="all">Todos</option>
          <option value="following">Quem eu sigo</option>
          <option value="nobody">Ninguém</option>
        </select>
      </div>

      <div className="space-y-3">
        <Label>Quem pode comentar</Label>
        <select
          value={settings.whoCanComment ?? "all"}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              whoCanComment: e.target.value as "all" | "following" | "nobody",
            }))
          }
          className="w-full border rounded-md p-2"
        >
          <option value="all">Todos</option>
          <option value="following">Quem eu sigo</option>
          <option value="nobody">Ninguém</option>
        </select>
      </div>

      <Button onClick={handleSave} disabled={updatePrivacy.isPending}>
        {updatePrivacy.isPending ? "Salvando..." : "Salvar privacidade"}
      </Button>
    </div>
  )
}
