"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useMyHoroscope } from "@/hooks/use-horoscopes"
import { WESTERN_SIGNS } from "@/lib/horoscopes/western"
import { CHINESE_ANIMALS } from "@/lib/horoscopes/chinese"
import { MAYAN_SEALS, MAYAN_TONES, kinToSealTone } from "@/lib/horoscopes/maya"

/**
 * T144/AC-24: bloco "Horóscopos" do perfil — ocidental, chinês e maia.
 * `ProfileHoroscopes` é puramente apresentacional (perfil público, signos
 * pré-computados no server sob o gate de privacidade de arcana);
 * `MyProfileHoroscopes` deriva os signos do próprio usuário via
 * `useMyHoroscope` (T094) e exibe hint quando o birthDate está ausente.
 */
export interface ProfileHoroscopeSigns {
  western: { signId: string } | null
  chinese: { animalId: string; element: string | null } | null
  maya: { kin: number } | null
}

function westernLabel(signId: string): string | null {
  const sign = WESTERN_SIGNS.find((s) => s.id === signId)
  return sign ? `${sign.emoji} ${sign.name} · ${sign.element}` : null
}

function chineseLabel(animalId: string, element: string | null): string | null {
  const animal = CHINESE_ANIMALS.find((a) => a.id === animalId)
  if (!animal) return null
  return element ? `${animal.name} (${element})` : animal.name
}

function mayaLabel(kin: number): string | null {
  if (!Number.isInteger(kin) || kin < 1 || kin > 260) return null
  const { sealIndex, toneId } = kinToSealTone(kin)
  const seal = MAYAN_SEALS[sealIndex]!
  const tone = MAYAN_TONES[toneId - 1]!
  return `Kin ${kin} — ${seal.name} ${tone.name}`
}

interface RowDef {
  label: string
  value: string | null
}

function rowsFromSigns(signs: ProfileHoroscopeSigns): RowDef[] {
  return [
    {
      label: "Signo ocidental",
      value: signs.western ? westernLabel(signs.western.signId) : null,
    },
    {
      label: "Zodíaco chinês",
      value: signs.chinese
        ? chineseLabel(signs.chinese.animalId, signs.chinese.element)
        : null,
    },
    {
      label: "Kin Maya",
      value: signs.maya ? mayaLabel(signs.maya.kin) : null,
    },
  ]
}

export function ProfileHoroscopes({
  signs,
}: {
  signs: ProfileHoroscopeSigns | null
}) {
  if (!signs) return null
  const rows = rowsFromSigns(signs).filter(
    (row): row is RowDef & { value: string } => row.value !== null,
  )
  if (rows.length === 0) return null

  return (
    <Card data-testid="profile-horoscopes">
      <CardHeader>
        <CardTitle className="text-base">Horóscopos</CardTitle>
        <CardDescription>Signos do seu perfil</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium">{row.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function MyProfileHoroscopes() {
  const { data, isLoading } = useMyHoroscope()

  if (isLoading || !data) return null

  const signs: ProfileHoroscopeSigns = {
    western: data.western ? { signId: data.western.signId } : null,
    chinese: data.chinese
      ? { animalId: data.chinese.signId, element: data.chinese.element ?? null }
      : null,
    maya: data.mayan ? { kin: Number(data.mayan.signId) } : null,
  }

  const hasAny = signs.western || signs.chinese || signs.maya

  return (
    <div className="space-y-4">
      <ProfileHoroscopes signs={signs} />
      {!hasAny && (
        <p className="text-sm text-muted-foreground" data-testid="signs-hint">
          Adicione sua data de nascimento no perfil para ver seus signos
          ocidental, chinês e maia.
        </p>
      )}
    </div>
  )
}
