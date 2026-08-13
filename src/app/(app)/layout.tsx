import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <>{children}</>;
}
