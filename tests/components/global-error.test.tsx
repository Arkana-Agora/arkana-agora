// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import * as Sentry from "@sentry/nextjs"
import { afterEach, describe, expect, it, vi } from "vitest"

import GlobalError from "@/app/global-error"

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}))

vi.mock("@/app/globals.css", () => ({}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("global-error (CRIT Sentry/estilos da review)", () => {
  it("renderiza o fallback compartilhado e captura a exceção no Sentry", () => {
    const error = new Error("root render boom")
    vi.spyOn(console, "error").mockImplementation(() => {})

    render(<GlobalError error={error} reset={vi.fn()} />)

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(Sentry.captureException).toHaveBeenCalledWith(error)
  })
})
