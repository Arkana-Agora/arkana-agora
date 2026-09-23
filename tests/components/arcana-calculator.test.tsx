import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { ArcanaCalculator } from "@/components/arcana/arcana-calculator"

describe("ArcanaCalculator", () => {
  it("renders name and birth date inputs", () => {
    cleanup()
    const { container } = render(<ArcanaCalculator onCalculate={vi.fn()} />)
    const inputs = container.querySelectorAll("input")
    expect(inputs.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByLabelText("Nome")).toBeInTheDocument()
    expect(screen.getByLabelText("Data de nascimento")).toBeInTheDocument()
  })

  it("renders calculate button", () => {
    cleanup()
    const { container } = render(<ArcanaCalculator onCalculate={vi.fn()} />)
    const buttons = container.querySelectorAll("button")
    const texts = Array.from(buttons).map((b) => b.textContent ?? "")
    expect(texts.some((t) => t.includes("Calcular"))).toBe(true)
  })

  it("calls onCalculate with name and date on submit", () => {
    cleanup()
    const onCalculate = vi.fn()
    const { container } = render(<ArcanaCalculator onCalculate={onCalculate} />)
    const inputs = container.querySelectorAll("input")
    const nameInput = inputs[0] as HTMLInputElement
    const dateInput = inputs[1] as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: "Maria Silva" } })
    fireEvent.change(dateInput, { target: { value: "1990-06-15" } })

    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("Calcular"),
    )!
    fireEvent.click(button)

    expect(onCalculate).toHaveBeenCalledWith({
      name: "Maria Silva",
      birthDate: "1990-06-15",
    })
  })

  it("does not call onCalculate with empty name", () => {
    cleanup()
    const onCalculate = vi.fn()
    const { container } = render(<ArcanaCalculator onCalculate={onCalculate} />)
    const inputs = container.querySelectorAll("input")
    const dateInput = inputs[1] as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: "1990-06-15" } })

    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("Calcular"),
    )!
    fireEvent.click(button)

    expect(onCalculate).not.toHaveBeenCalled()
  })

  it("disables button while loading", () => {
    cleanup()
    const { container } = render(
      <ArcanaCalculator onCalculate={vi.fn()} isLoading />,
    )
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("Calculando"),
    ) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })
})
