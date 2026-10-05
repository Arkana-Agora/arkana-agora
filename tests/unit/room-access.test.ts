import { afterEach, describe, expect, it, vi } from "vitest"

import { verifyRoomAccess } from "../../socket-service/src/room-access"

// Revisao M: verificador de visibilidade de room post:{id} — consulta
// GET /social/posts/:id com o Bearer do socket. 200 → true (visível);
// 401/403/404 → false (negado); infra fora/5xx/timeout → false
// (fail-closed — S2, revisão 2026-10-04: incerteza nunca abre join;
// o polling cobre a indisponibilidade). comment:{id} não tem endpoint
// hoje → false (T077 adicionará a checagem).

const AUTH_URL = "http://localhost:3000"

function stubFetch(
  impl: (
    url: string,
    init: RequestInit,
  ) => Response | Promise<Response> | never,
): ReturnType<typeof vi.fn> {
  const mock = vi.fn(async (input: unknown, init?: RequestInit) =>
    impl(String(input), init ?? {}),
  )
  vi.stubGlobal("fetch", mock)
  return mock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("verifyRoomAccess (revisao M)", () => {
  it("200 → true, chamando /social/posts/:id com o Bearer do socket", async () => {
    const mock = stubFetch(() => new Response("{}", { status: 200 }))
    const result = await verifyRoomAccess({
      room: "post:p1",
      token: "jwt-abc",
      authUrl: AUTH_URL,
    })
    expect(result).toBe(true)
    expect(mock).toHaveBeenCalledWith(
      `${AUTH_URL}/api/v1/social/posts/p1`,
      expect.objectContaining({
        headers: { Authorization: "Bearer jwt-abc" },
      }),
    )
  })

  it("404/403/401 → false (negado)", async () => {
    for (const status of [404, 403, 401]) {
      stubFetch(() => new Response("", { status }))
      await expect(
        verifyRoomAccess({ room: "post:p9", token: "t", authUrl: AUTH_URL }),
      ).resolves.toBe(false)
    }
  })

  it("5xx → false (fail-closed — S2: incerteza não abre join)", async () => {
    stubFetch(() => new Response("", { status: 500 }))
    await expect(
      verifyRoomAccess({ room: "post:p1", token: "t", authUrl: AUTH_URL }),
    ).resolves.toBe(false)
  })

  it("erro de rede/timeout → false (fail-closed — S2)", async () => {
    stubFetch(() => {
      throw new TypeError("fetch failed")
    })
    await expect(
      verifyRoomAccess({ room: "post:p1", token: "t", authUrl: AUTH_URL }),
    ).resolves.toBe(false)
  })

  it("comment: não tem endpoint → false sem chamar fetch (S2)", async () => {
    const mock = stubFetch(() => new Response("", { status: 200 }))
    await expect(
      verifyRoomAccess({ room: "comment:c1", token: "t", authUrl: AUTH_URL }),
    ).resolves.toBe(false)
    expect(mock).not.toHaveBeenCalled()
  })

  it("room fora do padrão post:/comment: → false sem chamar fetch", async () => {
    const mock = stubFetch(() => new Response("", { status: 200 }))
    await expect(
      verifyRoomAccess({ room: "user:x", token: "t", authUrl: AUTH_URL }),
    ).resolves.toBe(false)
    expect(mock).not.toHaveBeenCalled()
  })

  it("id com caracteres especiais é codificado na URL", async () => {
    const mock = stubFetch(() => new Response("", { status: 200 }))
    await verifyRoomAccess({
      room: "post:a/b?c",
      token: "t",
      authUrl: AUTH_URL,
    })
    expect(mock).toHaveBeenCalledWith(
      `${AUTH_URL}/api/v1/social/posts/${encodeURIComponent("a/b?c")}`,
      expect.anything(),
    )
  })
})
