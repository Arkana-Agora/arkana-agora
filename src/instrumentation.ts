import * as Sentry from "@sentry/nextjs"

import { getEnv } from "@/lib/env"

export async function register(): Promise<void> {
  // Fail-fast do env no boot do servidor (arch INFO-4): formatos inválidos
  // (ex.: REDIS_URL que não é URL) quebram aqui em vez do primeiro uso;
  // getEnv() cacheia para os consumidores lazy (moderation, queue, r2).
  getEnv()

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) {
    return
  }

  Sentry.init({
    dsn,
    enableLogs: true,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      if (process.env.NODE_ENV === "development") return null
      return event
    },
  })
}

export const onRequestError = Sentry.captureRequestError
