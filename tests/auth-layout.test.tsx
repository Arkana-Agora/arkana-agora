import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import AuthLayout from "@/app/(auth)/layout"

describe("AuthLayout", () => {
  beforeEach(() => {
    cleanup()
  })

  it("should have AuthLayout export", () => {
    expect(AuthLayout).toBeDefined()
  })

  it("renders children correctly", () => {
    render(
      <AuthLayout>
        <span data-testid="child-content">Test Content</span>
      </AuthLayout>,
    )
    expect(screen.getByTestId("child-content")).toBeInTheDocument()
    cleanup()
  })

  it("applies gradient background classes", () => {
    const { container } = render(
      <AuthLayout>
        <span data-testid="placeholder" />
      </AuthLayout>,
    )
    const layoutContainer = container.querySelector(
      '[data-testid="auth-layout-container"]',
    )
    expect(layoutContainer).toHaveClass("bg-gradient-to-br")
    expect(layoutContainer).toHaveClass("from-purple-50")
    expect(layoutContainer).toHaveClass("via-pink-50")
    expect(layoutContainer).toHaveClass("to-rose-50")
    expect(layoutContainer).toHaveClass("dark:from-gray-900")
    expect(layoutContainer).toHaveClass("dark:via-purple-950")
    expect(layoutContainer).toHaveClass("dark:to-gray-900")
    cleanup()
  })

  it("renders card with Arkana Agora title", () => {
    render(
      <AuthLayout>
        <span data-testid="placeholder" />
      </AuthLayout>,
    )
    expect(screen.getByText("Arkana Agora")).toBeInTheDocument()
    cleanup()
  })

  it("renders subtitle text", () => {
    render(
      <AuthLayout>
        <span data-testid="placeholder" />
      </AuthLayout>,
    )
    expect(
      screen.getByText("Entre para sua jornada espiritual"),
    ).toBeInTheDocument()
    cleanup()
  })

  it("applies responsive grid layout classes", () => {
    const { container } = render(
      <AuthLayout>
        <span data-testid="placeholder" />
      </AuthLayout>,
    )
    const gridContainer = container.querySelector(
      '[data-testid="auth-layout-grid"]',
    )
    expect(gridContainer).toHaveClass("grid-cols-1")
    expect(gridContainer).toHaveClass("lg:grid-cols-2")
    cleanup()
  })

  it("renders decorative image with correct alt text", () => {
    render(
      <AuthLayout>
        <span data-testid="placeholder" />
      </AuthLayout>,
    )
    const images = screen.getAllByAltText("Arkana Agora spiritual journey")
    expect(images.length).toBeGreaterThan(0)
    expect(images[0]).toBeInTheDocument()
    expect(images[0]).toHaveClass("rounded-3xl")
    expect(images[0]).toHaveClass("shadow-2xl")
    expect(images[0]).toHaveClass("object-cover")
    cleanup()
  })
})
