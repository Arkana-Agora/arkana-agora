import { afterEach, describe, expect, it, vi } from "vitest"

const KEY = "NEXT_PUBLIC_R2_PUBLIC_URL"
const previous: string | undefined = process.env[KEY]

async function importR2() {
  vi.resetModules()
  return await import("@/lib/r2")
}

afterEach(() => {
  if (previous === undefined) delete process.env[KEY]
  else process.env[KEY] = previous
})

describe("NEXT_PUBLIC_R2_PUBLIC_URL (src/lib/r2.ts)", () => {
  it("usa o valor da env quando presente", async () => {
    process.env[KEY] = "https://assets.example.com"
    const { NEXT_PUBLIC_R2_PUBLIC_URL } = await importR2()
    expect(NEXT_PUBLIC_R2_PUBLIC_URL).toBe("https://assets.example.com")
  })

  it("sem a env definida cai no fallback https://r2.arkanaagora.com", async () => {
    delete process.env[KEY]
    const { NEXT_PUBLIC_R2_PUBLIC_URL } = await importR2()
    expect(NEXT_PUBLIC_R2_PUBLIC_URL).toBe("https://r2.arkanaagora.com")
  })

  it("env vazia (ex.: .env.example sem valor) também cai no fallback", async () => {
    process.env[KEY] = ""
    const { NEXT_PUBLIC_R2_PUBLIC_URL } = await importR2()
    expect(NEXT_PUBLIC_R2_PUBLIC_URL).toBe("https://r2.arkanaagora.com")
  })
})
