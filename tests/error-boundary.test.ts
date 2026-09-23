import { describe, it, expect, beforeAll } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("Error Boundary", () => {
  const ebPath = join(process.cwd(), "src", "components", "error-boundary.tsx")
  let ebContent: string

  beforeAll(() => {
    ebContent = readFileSync(ebPath, "utf-8")
  })

  it("exists", () => {
    expect(ebContent).toBeTruthy()
  })

  it("is a client component", () => {
    expect(ebContent).toContain("use client")
  })

  it("extends React.Component", () => {
    expect(ebContent).toContain("Component")
  })

  it("implements componentDidCatch", () => {
    expect(ebContent).toContain("componentDidCatch")
  })

  it("implements getDerivedStateFromError", () => {
    expect(ebContent).toContain("getDerivedStateFromError")
  })

  it("has fallback UI with retry button", () => {
    expect(ebContent).toContain("fallback")
    expect(ebContent).toContain("Tentar")
  })

  it("renders children when no error", () => {
    expect(ebContent).toContain("this.props.children")
  })
})
