import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { privacySchema, usernameSchema } from "@/lib/validators/profile"
import { resolveUserSign } from "@/lib/horoscopes/user-signs"
import type { ProfileHoroscopeSigns } from "@/components/horoscopes/profile-horoscopes"
import type { Metadata } from "next"
import { PublicProfileClient } from "./client"

interface PageProps {
  params: Promise<{ username: string }>
}

/**
 * Parse de privacidade fail-closed: JSON malformado → `null` (trata como
 * fechado — não vaza nome/bio por um privacy corrompido). `null` no banco
 * (perfil nunca configurou privacidade) → defaults `{}` (campos opcionais
 * do schema, comportamento histórico de leitura).
 */
function parseProfilePrivacy(privacy: unknown): {
  profileVisibility?: "public" | "private" | undefined
  arcanaVisibility?: "public" | "private" | undefined
} | null {
  if (privacy == null) return {}
  const parsed = privacySchema.passthrough().safeParse(privacy)
  return parsed.success
    ? {
        profileVisibility: parsed.data.profileVisibility,
        arcanaVisibility: parsed.data.arcanaVisibility,
      }
    : null
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username } = await params
  const parsed = usernameSchema.safeParse(username)
  if (!parsed.success) return { title: "Perfil não encontrado" }

  const profile = await prisma.userProfile.findUnique({
    where: { username: parsed.data },
    include: { user: { select: { name: true } } },
  })

  if (!profile) return { title: "Perfil não encontrado" }

  // Mesma regra da página (review): perfil privado ou privacy malformado
  // não pode vazar nome/bio via <title>/description.
  const privacy = parseProfilePrivacy(profile.privacy)
  if (privacy === null || privacy.profileVisibility === "private") {
    return { title: "Perfil não encontrado" }
  }

  return {
    title: `${profile.user.name} — Arkana Ágora`,
    description:
      profile.bio ?? `Perfil de ${profile.user.name} na Arkana Ágora`,
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params
  const parsed = usernameSchema.safeParse(username)
  if (!parsed.success) notFound()

  const profile = await prisma.userProfile.findUnique({
    where: { username: parsed.data },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          displayName: true,
          avatar: true,
          plan: true,
          birthDate: true,
          astrologicalSign: true,
          mayanKin: true,
          personalArcana: true,
        },
      },
    },
  })

  if (!profile) notFound()

  const privacy = parseProfilePrivacy(profile.privacy)
  if (privacy === null || privacy.profileVisibility === "private") notFound()

  const astrology =
    privacy.arcanaVisibility !== "private"
      ? {
          sunSign: profile.user.astrologicalSign,
          personalArcana: profile.user.personalArcana,
          kinMaya: profile.user.mayanKin,
        }
      : null

  // T144 (RF-HORO-004): signos do perfil sob o mesmo gate de privacidade
  // de arcanaVisibility — servidos pelo server (sem hook do viewer).
  const astroInput = {
    birthDate: profile.user.birthDate,
    astrologicalSign: profile.user.astrologicalSign,
  }
  const westernSign = resolveUserSign("western", astroInput)
  const chineseSign = resolveUserSign("chinese", astroInput)
  const storedKin = Number(profile.user.mayanKin)
  const mayaSign =
    Number.isInteger(storedKin) && storedKin >= 1 && storedKin <= 260
      ? storedKin
      : (() => {
          const resolved = resolveUserSign("maya", astroInput)
          return resolved !== null ? Number(resolved.signId) : null
        })()

  const horoscopeSigns: ProfileHoroscopeSigns | null = astrology
    ? {
        western: westernSign ? { signId: westernSign.signId } : null,
        chinese: chineseSign
          ? { animalId: chineseSign.signId, element: chineseSign.element }
          : null,
        maya:
          mayaSign !== null && Number.isFinite(mayaSign)
            ? { kin: mayaSign }
            : null,
      }
    : null

  return (
    <PublicProfileClient
      profile={{
        id: profile.user.id,
        name: profile.user.name,
        username: profile.username ?? "",
        bio: profile.bio,
        avatarUrl: profile.user.avatar,
        plan: profile.user.plan,
        location: profile.location ?? "",
        ...(astrology && { astrology }),
      }}
      horoscopeSigns={horoscopeSigns}
    />
  )
}
