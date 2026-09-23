import { vi } from "vitest"
import "@testing-library/jest-dom/vitest"

if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn()
}

if (typeof URL !== "undefined") {
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => "blob:mock-object-url")
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = vi.fn()
  }
}
