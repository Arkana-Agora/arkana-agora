import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { CachedInterpretationNotice } from "@/components/ai/cached-notice"

describe("CachedInterpretationNotice", () => {
  it("renders notice text", () => {
    render(<CachedInterpretationNotice />)
    expect(screen.getByText(/gerada anteriormente/)).toBeTruthy()
  })

  it("renders with custom className", () => {
    const { container } = render(
      <CachedInterpretationNotice className="custom-class" />,
    )
    expect(container.firstChild).toBeTruthy()
  })
})
