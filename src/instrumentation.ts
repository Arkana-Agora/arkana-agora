import * as Sentry from "@sentry/nextjs"

export async function register(): Promise<void> {
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
