import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const init = vi.fn()
const capture = vi.fn()
const reset = vi.fn()
const peopleSet = vi.fn()
const optOutCapturing = vi.fn()
const optInCapturing = vi.fn()
const callOrder: string[] = []

vi.mock("posthog-js", () => ({
  default: {
    init: (...args: unknown[]) => {
      callOrder.push("init")
      return init(...args)
    },
    capture: (...args: unknown[]) => capture(...args),
    reset: (...args: unknown[]) => {
      callOrder.push("reset")
      return reset(...args)
    },
    opt_out_capturing: (...args: unknown[]) => {
      callOrder.push("opt_out")
      return optOutCapturing(...args)
    },
    opt_in_capturing: (...args: unknown[]) => {
      callOrder.push("opt_in")
      return optInCapturing(...args)
    },
    people: { set: (...args: unknown[]) => peopleSet(...args) },
  },
}))

const originalEnv = process.env.NODE_ENV

function setNodeEnv(value: string) {
  Object.defineProperty(process, "env", {
    configurable: true,
    value: { ...process.env, NODE_ENV: value },
  })
}

async function loadAnalytics() {
  vi.resetModules()
  return import("@/lib/analytics")
}

function clearMocks() {
  init.mockClear()
  capture.mockClear()
  reset.mockClear()
  peopleSet.mockClear()
  optOutCapturing.mockClear()
  optInCapturing.mockClear()
  callOrder.length = 0
}

afterEach(() => {
  setNodeEnv(originalEnv)
  clearMocks()
})

describe("initAnalytics", () => {
  beforeEach(() => {
    clearMocks()
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test_token"
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://us.i.posthog.com"
    localStorage.clear()
  })

  it("does not init PostHog in development", async () => {
    setNodeEnv("development")
    localStorage.setItem("analytics-consent", "true")
    const { initAnalytics } = await loadAnalytics()
    initAnalytics()
    expect(init).not.toHaveBeenCalled()
  })

  it("does not init PostHog without consent", async () => {
    setNodeEnv("test")
    const { initAnalytics } = await loadAnalytics()
    initAnalytics()
    expect(init).not.toHaveBeenCalled()
  })

  it("inits outside development with session recording and dead clicks disabled", async () => {
    setNodeEnv("test")
    localStorage.setItem("analytics-consent", "true")
    const { initAnalytics } = await loadAnalytics()
    initAnalytics()
    expect(init).toHaveBeenCalledWith(
      "phc_test_token",
      expect.objectContaining({
        disable_session_recording: true,
        capture_dead_clicks: false,
        autocapture: false,
      }),
    )
  })

  it("skips init when PostHog key is missing", async () => {
    setNodeEnv("test")
    localStorage.setItem("analytics-consent", "true")
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { initAnalytics } = await loadAnalytics()
    initAnalytics()
    expect(init).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith("[Analytics] PostHog key not configured")
    warn.mockRestore()
  })
})

describe("consent-gated capture", () => {
  beforeEach(() => {
    clearMocks()
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test_token"
    localStorage.clear()
    setNodeEnv("test")
  })

  it("track is a no-op without consent", async () => {
    const { initAnalytics, trackSignup } = await loadAnalytics()
    initAnalytics()
    trackSignup("email", "test")
    expect(init).not.toHaveBeenCalled()
    expect(capture).not.toHaveBeenCalled()
  })

  it("track captures after consent + init", async () => {
    localStorage.setItem("analytics-consent", "true")
    const { initAnalytics, trackSignup } = await loadAnalytics()
    initAnalytics()
    trackSignup("email", "test")
    expect(capture).toHaveBeenCalledWith("signup", {
      method: "email",
      referrer: "test",
    })
  })

  it("setAnalyticsConsent(false) resets identity BEFORE opting out", async () => {
    localStorage.setItem("analytics-consent", "true")
    const { initAnalytics, setAnalyticsConsent } = await loadAnalytics()
    initAnalytics()
    expect(init).toHaveBeenCalledTimes(1)
    setAnalyticsConsent(false)
    expect(localStorage.getItem("analytics-consent")).toBe("false")
    expect(reset).toHaveBeenCalled()
    expect(optOutCapturing).toHaveBeenCalled()
    // reset() deletes the persisted opt-out key — opting out after the
    // reset is what actually keeps the SDK silent after a revoke.
    expect(callOrder.indexOf("reset")).toBeLessThan(
      callOrder.indexOf("opt_out"),
    )
  })

  it("revoke then re-grant re-enables capture without a second init", async () => {
    localStorage.setItem("analytics-consent", "true")
    const { initAnalytics, setAnalyticsConsent, trackSignup } =
      await loadAnalytics()
    initAnalytics()
    setAnalyticsConsent(false)
    setAnalyticsConsent(true)
    expect(localStorage.getItem("analytics-consent")).toBe("true")
    expect(optInCapturing).toHaveBeenCalledWith({ captureEventName: false })
    expect(init).toHaveBeenCalledTimes(1)
    trackSignup("email", "test")
    expect(capture).toHaveBeenCalledWith("signup", {
      method: "email",
      referrer: "test",
    })
  })

  it("resetUser re-asserts opt-out after reset while consent is revoked", async () => {
    localStorage.setItem("analytics-consent", "true")
    const { initAnalytics, setAnalyticsConsent, resetUser } =
      await loadAnalytics()
    initAnalytics()
    setAnalyticsConsent(false)
    // logout path: SDK still initialized, app consent still "false" —
    // reset() deletes the persisted opt-out, so it must be re-applied.
    clearMocks()
    resetUser()
    expect(reset).toHaveBeenCalledTimes(1)
    expect(callOrder).toEqual(["reset", "opt_out"])
  })

  it("resetUser does not opt out while consent is granted", async () => {
    localStorage.setItem("analytics-consent", "true")
    const { initAnalytics, resetUser } = await loadAnalytics()
    initAnalytics()
    clearMocks()
    resetUser()
    expect(callOrder).toEqual(["reset"])
    expect(optOutCapturing).not.toHaveBeenCalled()
  })

  it("setAnalyticsConsent(true) initializes after consent granted", async () => {
    localStorage.clear()
    const { setAnalyticsConsent } = await loadAnalytics()
    setAnalyticsConsent(true)
    expect(localStorage.getItem("analytics-consent")).toBe("true")
    expect(init).toHaveBeenCalledTimes(1)
    expect(optInCapturing).toHaveBeenCalledTimes(1)
  })
})
