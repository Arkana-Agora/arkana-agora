// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const { setAnalyticsConsentMock } = vi.hoisted(() => ({
  setAnalyticsConsentMock: vi.fn((value: boolean) => {
    localStorage.setItem("analytics-consent", String(value))
  }),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

vi.mock("@/lib/analytics", () => ({
  ANALYTICS_CONSENT_STORAGE_KEY: "analytics-consent",
  setAnalyticsConsent: (value: boolean) => setAnalyticsConsentMock(value),
}))

import { AnalyticsConsentBanner } from "@/components/analytics/consent-banner"

const STORAGE_KEY = "analytics-consent"

function getSwitch(): HTMLInputElement {
  return screen.getByLabelText("Ativar analytics de uso") as HTMLInputElement
}

describe("AnalyticsConsentBanner", () => {
  beforeEach(() => {
    localStorage.clear()
    setAnalyticsConsentMock.mockClear()
  })

  it("opens the dialog when no consent decision is stored", () => {
    render(<AnalyticsConsentBanner />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(getSwitch()).not.toBeChecked()
  })

  it("persists reject without page reload", () => {
    render(<AnalyticsConsentBanner />)
    fireEvent.click(screen.getByRole("button", { name: /rejeitar analytics/i }))

    expect(setAnalyticsConsentMock).toHaveBeenCalledWith(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe("false")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("persists accept when switch is on", () => {
    render(<AnalyticsConsentBanner />)
    fireEvent.click(getSwitch())
    expect(getSwitch()).toBeChecked()

    fireEvent.click(
      screen.getByRole("button", { name: /salvar com analytics/i }),
    )

    expect(setAnalyticsConsentMock).toHaveBeenCalledWith(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("hydrates switch from stored consent when reopened", async () => {
    localStorage.setItem(STORAGE_KEY, "true")
    render(<AnalyticsConsentBanner />)

    // No dialog on first paint when consent exists — only the preferences button.
    expect(screen.queryByRole("dialog")).toBeNull()

    fireEvent.click(
      screen.getByRole("button", { name: /preferências de analytics/i }),
    )

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })
    expect(getSwitch()).toBeChecked()
  })

  it("dismissing via Escape or backdrop does not persist a choice", async () => {
    render(<AnalyticsConsentBanner />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(setAnalyticsConsentMock).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    fireEvent.click(
      screen.getByRole("button", { name: /preferências de analytics/i }),
    )
    await waitFor(() => screen.getByRole("dialog"))

    const backdrop = document.querySelector(".fixed.inset-0") as HTMLElement
    fireEvent.click(backdrop)

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(setAnalyticsConsentMock).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
