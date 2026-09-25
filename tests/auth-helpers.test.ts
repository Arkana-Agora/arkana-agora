import { describe, expect, it } from "vitest"

import { maskEmail } from "@/app/api/v1/auth/_helpers"

describe("maskEmail", () => {
  it("masks the local part keeping the first two characters", () => {
    expect(maskEmail("alice@example.com")).toBe("al***@example.com")
    expect(maskEmail("maria.silva@gmail.com")).toBe("ma*********@gmail.com")
  })

  it("always hides at least one character of short locals", () => {
    expect(maskEmail("ab@x.com")).toBe("a*@x.com")
    expect(maskEmail("a@x.com")).toBe("*@x.com")
  })

  it("never exposes the whole local part for any input length", () => {
    for (const local of ["a", "ab", "abc", "abcd", "alice", "johndoe"]) {
      const masked = maskEmail(`${local}@example.com`)
      const maskedLocal = masked.slice(0, masked.indexOf("@"))
      expect(maskedLocal).not.toBe(local)
      expect(maskedLocal).toContain("*")
    }
  })

  it("rejects inputs without a local part", () => {
    expect(maskEmail("@example.com")).toBe("***")
    expect(maskEmail("not-an-email")).toBe("***")
    expect(maskEmail("")).toBe("***")
  })

  it("keeps the domain as-is for abuse pattern diagnostics", () => {
    expect(maskEmail("alice@SUSPICIOUS.example")).toBe(
      "al***@SUSPICIOUS.example",
    )
  })
})
