import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/auth/auth"
import { AppHeader } from "@/components/layout/app-header"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <div className="flex-1 pb-16 md:pb-0">{children}</div>
    </div>
  )
}
