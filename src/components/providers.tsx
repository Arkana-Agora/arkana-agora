"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "next-auth/react"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"

import { AnalyticsConsentBanner } from "@/components/analytics/consent-banner"
import { ErrorBoundary } from "@/components/error-boundary"
import { MobileNav } from "@/components/layout/mobile-nav"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"

function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("SW registration failed:", err)
      })
    }
  }, [])

  return null
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  useEffect(() => {
    const consent = localStorage.getItem("analytics-consent")
    if (consent === "true") {
      // Dynamic import to avoid SSR issues
      import("@/lib/analytics").then(({ initAnalytics }) => {
        initAnalytics()
      })
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ServiceWorkerRegistration />
          <ErrorBoundary>{children}</ErrorBoundary>
          <MobileNav />
          <AnalyticsConsentBanner />
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
