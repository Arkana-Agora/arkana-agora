import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sentryInitMock = vi.hoisted(() => vi.fn())
const captureRequestErrorMock = vi.hoisted(() => vi.fn())

vi.mock("@sentry/nextjs", () => ({
  init: sentryInitMock,
  captureRequestError: captureRequestErrorMock,
}))

import { register } from "@/instrumentation"

const ORIGINAL_SENTRY_DSN = process.env.SENTRY_DSN

describe("instrumentation.register", () => {
  beforeEach(() => {
    sentryInitMock.mockReset()
    delete process.env.SENTRY_DSN
  })

  afterEach(() => {
    if (ORIGINAL_SENTRY_DSN === undefined) {
      delete process.env.SENTRY_DSN
    } else {
      process.env.SENTRY_DSN = ORIGINAL_SENTRY_DSN
    }
  })

  it("does not initialise Sentry without a DSN", async () => {
    await expect(register()).resolves.toBeUndefined()
    expect(sentryInitMock).not.toHaveBeenCalled()
  })

  it("initialises Sentry once when a DSN is present", async () => {
    process.env.SENTRY_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0"

    await register()

    expect(sentryInitMock).toHaveBeenCalledTimes(1)
    expect(sentryInitMock.mock.calls[0]?.[0]).toMatchObject({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
    })
  })
})
