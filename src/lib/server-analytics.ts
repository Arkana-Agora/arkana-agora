// Telemetria PostHog server-side (T145 — extensão de T024 para eventos de
// sistema). O `track()` de `src/lib/analytics.ts` é consent-gated e no-op
// sem browser (posthog-js + localStorage), então cron/jobs Node precisam
// de capture próprio via `POST {host}/capture/` (HTTP API do PostHog).
//
// CHK017 (consent gate): evento de SISTEMA sem dado pessoal — payload
// mínimo (`api_key`, `event`, `properties` com `distinct_id` sintético
// `system-cron`, sem userId/cookies/IP próprio) → fora do escopo do gate
// CHK002/LGPD, que protege eventos de usuário. Falha de rede/log nunca
// propaga: telemetria não pode derrubar um cron (AC-24).

import { logger } from "@/lib/logger"

const PH_API_KEY = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const PH_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com"

/**
 * Envia um evento para o PostHog (best-effort). No-op em desenvolvimento
 * (mesmo gate do `initAnalytics`) e sem token configurado.
 */
export async function trackServerEvent(
  event: string,
  properties: Record<string, unknown>,
): Promise<void> {
  if (process.env.NODE_ENV === "development" || !PH_API_KEY) return

  try {
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: PH_API_KEY,
        event,
        // distinct_id DEPOIS do spread: propriedade do chamador nunca
        // sobrescreve o identificador sintético de sistema (CHK017).
        properties: { ...properties, distinct_id: "system-cron" },
        timestamp: new Date().toISOString(),
      }),
    }
    if (typeof AbortSignal.timeout === "function") {
      init.signal = AbortSignal.timeout(5_000)
    }
    await fetch(`${PH_HOST}/capture/`, init)
  } catch (err) {
    logger.warn({ err, event }, "server_analytics_capture_failed")
  }
}

/**
 * AC-24/RNF-HORO-001: conteúdo diário ocidental ausente no check das
 * 06:00 BRT (T145) — sinaliza para investigar o cron T097/worker T098.
 */
export async function trackHoroscopeMissing(
  missingSignIds: readonly string[],
  date: string,
): Promise<void> {
  await trackServerEvent("horoscope_missing", {
    missingSignIds: [...missingSignIds],
    missingCount: missingSignIds.length,
    date,
  })
}
