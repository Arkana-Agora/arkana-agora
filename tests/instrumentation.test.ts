import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sentryInitMock = vi.hoisted(() => vi.fn())
const captureRequestErrorMock = vi.hoisted(() => vi.fn())

vi.mock("@sentry/nextjs", () => ({
  init: sentryInitMock,
  captureRequestError: captureRequestErrorMock,
}))

import { register } from "@/instrumentation"
import { resetEnvCache } from "@/lib/env"

const ORIGINAL_NEXT_PUBLIC_SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

describe("instrumentation.register", () => {
  beforeEach(() => {
    sentryInitMock.mockReset()
    delete process.env.NEXT_PUBLIC_SENTRY_DSN
  })

  afterEach(() => {
    if (ORIGINAL_NEXT_PUBLIC_SENTRY_DSN === undefined) {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN
    } else {
      process.env.NEXT_PUBLIC_SENTRY_DSN = ORIGINAL_NEXT_PUBLIC_SENTRY_DSN
    }
    delete process.env.REDIS_URL
    resetEnvCache()
  })

  it("does not initialise Sentry without a DSN", async () => {
    await expect(register()).resolves.toBeUndefined()
    expect(sentryInitMock).not.toHaveBeenCalled()
  })

  it("initialises Sentry once when a DSN is present", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://examplePublicKey@o0.ingest.sentry.io/0"

    await register()

    expect(sentryInitMock).toHaveBeenCalledTimes(1)
    expect(sentryInitMock.mock.calls[0]?.[0]).toMatchObject({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
    })
  })

  it("valida env no boot: falha fast com formato inválido (arch INFO-4)", async () => {
    process.env.REDIS_URL = "not a valid url"
    resetEnvCache()

    await expect(register()).rejects.toThrow(/REDIS_URL/)
    expect(sentryInitMock).not.toHaveBeenCalled()
  })
})
