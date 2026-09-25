import { afterEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { render, waitFor } from "@testing-library/react"

const { mockSearchParamsRaw } = vi.hoisted(() => ({
  mockSearchParamsRaw: { current: null as string | null },
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearchParamsRaw.current ?? ""),
}))

import {
  AuthSessionBridge,
  consumeStoredCallbackUrl,
  isSafeCallbackPath,
} from "@/hooks/use-safe-callback-url"

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
  mockSearchParamsRaw.current = null
})

describe("isSafeCallbackPath", () => {
  it.each([
    "/dashboard",
    "/",
    "/tiragem?deck=rws",
    "/minhas-tiragens?page=2",
    "/perfil",
  ])("accepts same-origin path %s", (value) => {
    expect(isSafeCallbackPath(value)).toBe(true)
  })

  it.each([
    ["protocol-relative", "//evil.com"],
    ["backslash authority", "/\\evil.com"],
    ["double backslash authority", "/\\\\evil.com"],
    ["literal LF authority", "/\n/evil.com"],
    ["literal CR authority", "/\r/evil.com"],
    ["literal TAB authority", "/\t/evil.com"],
    ["encoded LF (decode-then-reparse)", "/%0a/evil.com"],
    ["encoded CR", "/%0d/evil.com"],
    ["encoded TAB", "/%09/evil.com"],
    ["encoded backslash", "/%5cevil.com"],
    ["absolute URL", "https://evil.com"],
    ["scheme URL", "javascript:alert(1)"],
    ["relative path", "dashboard"],
    ["empty", ""],
    ["malformed percent-encoding", "/%zz"],
  ])("rejects %s", (_label, value) => {
    expect(isSafeCallbackPath(value)).toBe(false)
  })

  it("rejects null, undefined and empty inputs", () => {
    expect(isSafeCallbackPath(null)).toBe(false)
    expect(isSafeCallbackPath(undefined)).toBe(false)
  })
})

describe("consumeStoredCallbackUrl", () => {
  it("returns a validated stored path and clears it", () => {
    sessionStorage.setItem("auth-callback-url", "/tiragem?deck=rws")
    expect(consumeStoredCallbackUrl()).toBe("/tiragem?deck=rws")
    expect(sessionStorage.getItem("auth-callback-url")).toBeNull()
  })

  it("falls back to /dashboard for a tampered stored value", () => {
    sessionStorage.setItem("auth-callback-url", "//evil.com")
    expect(consumeStoredCallbackUrl()).toBe("/dashboard")
    expect(sessionStorage.getItem("auth-callback-url")).toBeNull()
  })

  it("falls back when nothing is stored", () => {
    expect(consumeStoredCallbackUrl()).toBe("/dashboard")
  })

  it("honors a custom fallback", () => {
    expect(consumeStoredCallbackUrl("/perfil")).toBe("/perfil")
  })

  it("falls back when sessionStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied")
    })
    expect(consumeStoredCallbackUrl()).toBe("/dashboard")
  })
})

describe("AuthSessionBridge", () => {
  it("stashes a valid callbackUrl for later consumption", async () => {
    mockSearchParamsRaw.current = "callbackUrl=/minhas-tiragens"

    render(createElement(AuthSessionBridge))

    await waitFor(() =>
      expect(sessionStorage.getItem("auth-callback-url")).toBe(
        "/minhas-tiragens",
      ),
    )
  })

  it("clears a stale stash when the URL has no callbackUrl", async () => {
    sessionStorage.setItem("auth-callback-url", "/stale-attempt")
    mockSearchParamsRaw.current = null

    render(createElement(AuthSessionBridge))

    await waitFor(() =>
      expect(sessionStorage.getItem("auth-callback-url")).toBeNull(),
    )
  })

  it("clears the stash when the callbackUrl is unsafe", async () => {
    sessionStorage.setItem("auth-callback-url", "/stale-attempt")
    mockSearchParamsRaw.current = "callbackUrl=//evil.com"

    render(createElement(AuthSessionBridge))

    await waitFor(() =>
      expect(sessionStorage.getItem("auth-callback-url")).toBeNull(),
    )
  })
})
