import { vi, afterEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"

// Calculos de arcano usam getters UTC; fixa o fuso para testes deterministas
// independente da maquina que roda a suite.
process.env.TZ = "UTC"

afterEach(() => {
  cleanup()
})

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
