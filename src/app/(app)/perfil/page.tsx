import { redirect } from "next/navigation"
import { auth } from "@/auth/auth"
import { prisma } from "@/lib/prisma"
import { privacySchema } from "@/lib/validators/profile"
import { OwnProfile } from "./own-profile"

export const dynamic = "force-dynamic"

export default async function OwnProfilePage() {
  const session = await auth()
  const email = session?.user?.email

  if (!email) {
    redirect("/login")
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      displayName: true,
      avatar: true,
      plan: true,
      astrologicalSign: true,
      mayanKin: true,
      personalArcana: true,
      profile: {
        select: {
          username: true,
          bio: true,
          location: true,
          privacy: true,
        },
      },
    },
  })

  if (!user) {
    redirect("/dashboard")
  }

  const privacy =
    privacySchema.passthrough().safeParse(user.profile?.privacy).data ?? {}
  const astrology =
    privacy.arcanaVisibility !== "private"
      ? {
          sunSign: user.astrologicalSign,
          personalArcana: user.personalArcana,
          kinMaya: user.mayanKin,
        }
      : null

  return (
    <OwnProfile
      profile={{
        id: user.id,
        name: user.displayName || user.name,
        username: user.profile?.username ?? "",
        bio: user.profile?.bio ?? null,
        avatarUrl: user.avatar,
        plan: user.plan,
        location: user.profile?.location ?? "",
        ...(astrology && { astrology }),
      }}
    />
  )
}
