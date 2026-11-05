import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.stubGlobal("fetch", fetchMock)
vi.mock("@/lib/logger", () => ({ logger: loggerMock }))

// T145/CHK017 — telemetria de sistema para cron server-side: o `track()`
// de `src/lib/analytics.ts` (T024) é consent-gated e no-op sem browser
// (posthog-js), então eventos de cron (`horoscope_missing`) precisam de
// capture próprio via POST /capture/ — sem janela, sem localStorage, sem
// dado pessoal (distinct_id sintético `system-cron` → fora do escopo do
// gate CHK002/LGPD, que protege eventos de usuário).

const HOST = "https://ph.example.test"

async function loadAnalytics() {
  return import("@/lib/server-analytics")
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockResolvedValue({ ok: true, status: 200 })
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_token")
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", HOST)
  vi.stubEnv("NODE_ENV", "test")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

function sentPayload(): {
  api_key: string
  event: string
  properties: Record<string, unknown>
} {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(url).toBe(`${HOST}/capture/`)
  expect(init.method).toBe("POST")
  return JSON.parse(String(init.body)) as {
    api_key: string
    event: string
    properties: Record<string, unknown>
  }
}

describe("trackServerEvent (T145)", () => {
  it("envia POST /capture/ com api_key, distinct_id de sistema e evento", async () => {
    const { trackServerEvent } = await loadAnalytics()

    await trackServerEvent("horoscope_missing", { date: "2026-10-20" })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const payload = sentPayload()
    expect(payload.api_key).toBe("phc_token")
    expect(payload.event).toBe("horoscope_missing")
    expect(payload.properties.distinct_id).toBe("system-cron")
    expect(payload.properties.date).toBe("2026-10-20")
  })

  it("nao envia sem token PostHog configurado", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "")
    const { trackServerEvent } = await loadAnalytics()

    await trackServerEvent("horoscope_missing", {})

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("nao envia em desenvolvimento (mesmo gate do initAnalytics)", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const { trackServerEvent } = await loadAnalytics()

    await trackServerEvent("horoscope_missing", {})

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("falha de rede nunca propaga (cron nao pode 500 por telemetria)", async () => {
    fetchMock.mockRejectedValue(new Error("posthog down"))
    const { trackServerEvent } = await loadAnalytics()

    await expect(
      trackServerEvent("horoscope_missing", {}),
    ).resolves.toBeUndefined()
    expect(loggerMock.warn).toHaveBeenCalled()
  })

  it("distinct_id de sistema nao e sobrescrevivel pelo chamador (CHK017)", async () => {
    const { trackServerEvent } = await loadAnalytics()

    await trackServerEvent("horoscope_missing", {
      distinct_id: "user-123",
      date: "2026-10-20",
    })

    const payload = sentPayload()
    expect(payload.properties.distinct_id).toBe("system-cron")
  })
})

describe("trackHoroscopeMissing (T024/T145)", () => {
  it("emite horoscope_missing com signIds ausentes, contagem e data", async () => {
    const { trackHoroscopeMissing } = await loadAnalytics()

    await trackHoroscopeMissing(["aries", "touro"], "2026-10-20")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const payload = sentPayload()
    expect(payload.event).toBe("horoscope_missing")
    expect(payload.properties.missingSignIds).toEqual(["aries", "touro"])
    expect(payload.properties.missingCount).toBe(2)
    expect(payload.properties.date).toBe("2026-10-20")
  })
})
