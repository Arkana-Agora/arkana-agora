import { describe, it, expect } from "vitest"
import { AuthLayout } from "@/app/(auth)/layout"

describe("AuthLayout", () => {
  it("should have AuthLayout export", () => {
    expect(AuthLayout).toBeDefined()
  })

  it("should accept children prop", () => {
    const TestComponent = () => <div>Test Content</div>
    expect(() => (
      <AuthLayout>
        <TestComponent />
      </AuthLayout>
    )).not.toThrow()
  })
})
