import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { usernameSchema } from "@/lib/validators/profile"
import type { PrivacySettings } from "@/lib/validators/profile"
import type { Metadata } from "next"
import { PublicProfileClient } from "./client"

interface PageProps {
  params: Promise<{ username: string }>
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

  const privacy = (profile.privacy as PrivacySettings) ?? {}
  if (privacy.profileVisibility === "private") notFound()

  const astrology =
    privacy.arcanaVisibility !== "private"
      ? {
          sunSign: profile.user.astrologicalSign,
          personalArcana: profile.user.personalArcana,
          kinMaya: profile.user.mayanKin,
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
    />
  )
}
