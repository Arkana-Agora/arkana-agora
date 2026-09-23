import { redirect } from "next/navigation"
import { auth } from "@/auth/auth"
import { prisma } from "@/lib/prisma"

export default async function OwnProfilePage() {
  const session = await auth()
  const email = session?.user?.email

  if (!email) {
    redirect("/login")
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { profile: { select: { username: true } } },
  })

  if (user?.profile?.username) {
    redirect(`/perfil/${user.profile.username}`)
  }

  redirect("/perfil/editar")
}
