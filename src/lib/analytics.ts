"use client"

import posthog from "posthog-js"

const PH_API_KEY = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const PH_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com"

let initialized = false

export function initAnalytics() {
  if (typeof window === "undefined" || initialized) return

  if (!PH_API_KEY) {
    console.warn("[Analytics] PostHog key not configured")
    return
  }

  posthog.init(PH_API_KEY!, {
    api_host: PH_HOST,
    debug: process.env.NODE_ENV === "development",
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage",
    autocapture: false,
    disable_session_recording: false,
  })

  initialized = true
}

function hasConsent(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem("analytics-consent") === "true"
}

function track(event: string, properties?: Record<string, unknown>) {
  if (!initialized || !hasConsent()) return
  posthog.capture(event, properties)
}

export function trackSignup(method: "email" | "google", referrer?: string) {
  track("signup", { method, referrer })
}

export function trackReading(
  deckId: string,
  spreadType: string,
  isDaily: boolean,
  cardsCount: number,
) {
  track("reading", { deckId, spreadType, isDaily, cardsCount })
}

export function trackAIInterpretation(
  mode: string,
  mood?: string,
  cached?: boolean,
  durationMs?: number,
) {
  track("ai_interpretation", { mode, mood, cached, durationMs })
}

export function trackArcanaCalculate(
  method: "date" | "name" | "combined",
  arcanaNumber: number,
) {
  track("arcana_calculate", { method, arcanaNumber })
}

export function setUserProperties(properties: Record<string, unknown>) {
  if (!initialized || !hasConsent()) return
  posthog.people.set(properties)
}

export function resetUser() {
  if (!initialized) return
  posthog.reset()
}

export function setAnalyticsConsent(consent: boolean) {
  if (typeof window === "undefined") return
  localStorage.setItem("analytics-consent", String(consent))
  if (consent && PH_API_KEY && !initialized) {
    initAnalytics()
  } else if (!consent) {
    resetUser()
  }
}

export function getAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem("analytics-consent") === "true"
}

export function initAnalyticsWithConsent() {
  const consent = getAnalyticsConsent()
  if (consent && PH_API_KEY && !initialized) {
    initAnalytics()
  }
}
