import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    enableLogs: true,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 0.1,
    ignoreErrors: ["NetworkError", "AbortError", "Failed to fetch"],
    beforeSend(event) {
      if (process.env.NODE_ENV === "development") return null
      return event
    },
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
