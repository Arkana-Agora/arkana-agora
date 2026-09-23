import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { Skeleton } from "@/components/ui/skeleton"

describe("Skeleton Component", () => {
  it("renders without crashing", () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it("has animate-pulse class", () => {
    const { container } = render(<Skeleton />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton.className).toContain("animate-pulse")
  })

  it("has bg-muted class", () => {
    const { container } = render(<Skeleton />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton.className).toContain("bg-muted")
  })

  it("accepts custom className", () => {
    const { container } = render(<Skeleton className="h-10 w-20" />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton.className).toContain("h-10")
    expect(skeleton.className).toContain("w-20")
  })

  it("accepts custom props", () => {
    const { container } = render(<Skeleton data-testid="custom-skeleton" />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton.getAttribute("data-testid")).toBe("custom-skeleton")
  })
})
