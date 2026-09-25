"use client"

import posthog from "posthog-js"

const PH_API_KEY = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const PH_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com"

let initialized = false

export const ANALYTICS_CONSENT_STORAGE_KEY = "analytics-consent"

function hasConsent(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) === "true"
}

export function initAnalytics() {
  if (typeof window === "undefined" || initialized) return

  // Skip entirely in development: remote config can re-enable recording/dead
  // clicks and fetch scripts from us.i.posthog.com — noisy when blocked.
  if (process.env.NODE_ENV === "development") return

  // Defense-in-depth: never start PostHog without explicit consent (LGPD).
  if (!hasConsent()) return

  if (!PH_API_KEY) {
    console.warn("[Analytics] PostHog key not configured")
    return
  }

  posthog.init(PH_API_KEY, {
    api_host: PH_HOST,
    debug: false,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage",
    autocapture: false,
    // Pin remote-config-toggleable loaders off locally so PostHog remote
    // config cannot re-enable them and lazy-load blocked external scripts.
    disable_session_recording: true,
    capture_dead_clicks: false,
  })

  initialized = true
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
  // reset() also deletes the persisted SDK consent key (__ph_opt_in_out_*),
  // which would silently re-enable auto-capture for a user who revoked
  // consent — re-assert the opt-out when our own consent says no.
  if (!hasConsent()) {
    try {
      posthog.opt_out_capturing()
    } catch {
      // SDK may be mid-init; our localStorage gate still blocks track()
    }
  }
}

export function setAnalyticsConsent(consent: boolean) {
  if (typeof window === "undefined") return
  localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, String(consent))
  if (consent) {
    if (!initialized) {
      initAnalytics()
    }
    if (initialized) {
      // Re-grant after revoke (or after a reload that left a persisted
      // opt-out): clear the SDK opt-out so captures resume in place.
      try {
        posthog.opt_in_capturing({ captureEventName: false })
      } catch {
        // SDK may be mid-init; initAnalytics will re-run on next boot
      }
    }
  } else if (initialized) {
    // Order matters: reset() deletes the persisted opt-out key
    // (__ph_opt_in_out_*), so reset FIRST and opt out AFTER — otherwise
    // the revoke is silently wiped and the SDK keeps capturing.
    resetUser()
    try {
      posthog.opt_out_capturing()
    } catch {
      // SDK may be mid-init; our localStorage gate still blocks track()
    }
  }
}

export function initAnalyticsWithConsent() {
  initAnalytics()
}
