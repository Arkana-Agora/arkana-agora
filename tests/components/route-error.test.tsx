// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as Sentry from "@sentry/nextjs"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RouteError } from "@/components/route-error"

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("RouteError (T039)", () => {
  it("renderiza fallback, mensagem, digest e dispara reset", () => {
    const reset = vi.fn()
    const error = Object.assign(new Error("boom"), { digest: "ABC123" })
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    render(<RouteError error={error} reset={reset} />)

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("Algo deu errado")).toBeInTheDocument()
    expect(screen.getByText(/Código do erro: ABC123/)).toBeInTheDocument()
    expect(errorSpy).toHaveBeenCalledWith("[route-error]", error)
    expect(Sentry.captureException).toHaveBeenCalledWith(error)

    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/ }))
    expect(reset).toHaveBeenCalledTimes(1)

    errorSpy.mockRestore()
  })

  it("sem digest não mostra o código", () => {
    render(<RouteError error={new Error("x")} reset={vi.fn()} />)

    expect(screen.queryByText(/Código do erro/)).toBeNull()
  })

  it("nunca renderiza error.message no DOM (S-N18: vazamento/integridade)", () => {
    const error = new Error("Mensagem interna sensível: sql state 42P01")

    render(<RouteError error={error} reset={vi.fn()} />)

    expect(screen.queryByText(/Mensagem interna sensível/)).toBeNull()
    expect(document.body.textContent).not.toContain("Mensagem interna sensível")
    expect(document.body.textContent).not.toContain("42P01")
  })
})
