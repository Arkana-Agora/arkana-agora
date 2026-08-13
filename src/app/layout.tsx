import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Geist } from "next/font/google"

import { cn } from "@/lib/utils"
import { Providers } from "@/components/providers"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })

export const metadata: Metadata = {
  title: "Arkana Agora",
  description:
    "Tarot, Lenormand, numerologia e astrologia com IA — social vertical",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={cn("font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
