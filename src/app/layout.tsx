import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { Geist } from "next/font/google"

import { Providers } from "@/components/providers"
import "./globals.css"

const font = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })

const APP_URL_FALLBACK = "https://arkanaagora.com"

function metadataBaseFromEnv(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || APP_URL_FALLBACK)
  } catch {
    return new URL(APP_URL_FALLBACK)
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBaseFromEnv(),
  title: {
    default: "Arkana Agora",
    template: "%s | Arkana Agora",
  },
  description:
    "Tarot, Lenormand, numerologia e astrologia com IA — plataforma social vertical para autoconhecimento",
  keywords: [
    "tarot",
    "lenormand",
    "numerologia",
    "astrologia",
    "arcano pessoal",
    "leitura de cartas",
    "esoterismo",
    "autoconhecimento",
  ],
  authors: [{ name: "Arkana Agora" }],
  creator: "Arkana Agora",
  publisher: "Arkana Agora",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://arkanaagora.com",
    siteName: "Arkana Agora",
    title: "Arkana Agora — Tarot, Numerologia e Astrologia com IA",
    description:
      "Descubra seu arcano pessoal, faça tiragens de tarot e lenormand, receba interpretações com IA. Sua jornada de autoconhecimento começa aqui.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Arkana Agora — Tarot e Numerologia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arkana Agora — Tarot e Numerologia com IA",
    description:
      "Tiragens de tarot, arcano pessoal, numerologia e astrologia com interpretação por IA.",
    images: ["/og-image.png"],
    creator: "@arkanaagora",
  },
  icons: {
    icon: "/icons/icon.svg",
    shortcut: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  manifest: "/manifest.json",
}

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="pt-BR" className={font.variable} suppressHydrationWarning>
      <body className={font.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Arkana Agora",
              description:
                "Plataforma de tarot, numerologia e astrologia com IA para autoconhecimento",
              url: "https://arkanaagora.com",
              applicationCategory: "LifestyleApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "BRL",
                availability: "https://schema.org/InStock",
              },
            }),
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
