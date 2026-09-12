import { describe, it, expect, beforeEach, vi } from "vitest"
import { useAuthStore } from "@/stores/auth-store"

const user = {
  id: "user-1",
  name: "Alice",
  email: "alice@example.com",
  displayName: null,
  role: "USER",
  plan: "FREE",
  avatar: null,
}

function mockJsonResponse(
  body: unknown,
  ok = true,
  status = ok ? 200 : 400,
): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

describe("auth-store", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
    vi.restoreAllMocks()
  })

  it("login bem-sucedido: armazena user, autentica e reseta isLoading", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(mockJsonResponse({ accessToken: "access-123", user }))

    await useAuthStore.getState().login("alice@example.com", "secret")

    const state = useAuthStore.getState()
    expect(state.user).toEqual(user)
    expect(state.isAuthenticated).toBe(true)
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/auth/login",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("login credenciais invalidas: define error legivel e lanca o codigo", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockJsonResponse(
        {
          error: {
            code: "AUTH_INVALID_CREDENTIALS",
            message: "E-mail ou senha invalidos",
          },
        },
        false,
        401,
      ),
    )

    await expect(
      useAuthStore.getState().login("alice@example.com", "errada"),
    ).rejects.toThrow("AUTH_INVALID_CREDENTIALS")

    const state = useAuthStore.getState()
    expect(state.error).toBe("E-mail ou senha invalidos")
    expect(state.isLoading).toBe(false)
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
  })

  it("login e-mail nao verificado: lanca AUTH_EMAIL_NOT_VERIFIED sem armazenar user", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockJsonResponse(
        {
          error: {
            code: "AUTH_EMAIL_NOT_VERIFIED",
            message: "E-mail nao verificado",
          },
        },
        false,
        403,
      ),
    )

    await expect(
      useAuthStore.getState().login("alice@example.com", "secret"),
    ).rejects.toThrow("AUTH_EMAIL_NOT_VERIFIED")

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
  })

  it("login com codigo de erro desconhecido: define message e lanca o codigo", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockJsonResponse(
        {
          error: { code: "SOME_NEW_CODE", message: "Novo erro do servidor" },
        },
        false,
        500,
      ),
    )

    await expect(
      useAuthStore.getState().login("alice@example.com", "secret"),
    ).rejects.toThrow("SOME_NEW_CODE")

    const state = useAuthStore.getState()
    expect(state.error).toBe("Novo erro do servidor")
    expect(state.isLoading).toBe(false)
  })

  it("login com falha de rede: reseta isLoading e define erro generico", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))

    await expect(
      useAuthStore.getState().login("alice@example.com", "secret"),
    ).rejects.toThrow()

    const state = useAuthStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBe("Erro ao fazer login")
    expect(state.isAuthenticated).toBe(false)
  })

  it("login com resposta nao-JSON (500): reseta isLoading e define erro generico", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    } as unknown as Response)

    await expect(
      useAuthStore.getState().login("alice@example.com", "secret"),
    ).rejects.toThrow()

    const state = useAuthStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBe("Erro ao fazer login")
  })

  it("clearError limpa o estado de erro", () => {
    useAuthStore.setState({ error: "E-mail ou senha invalidos" })
    useAuthStore.getState().clearError()
    expect(useAuthStore.getState().error).toBeNull()
  })

  describe("register", () => {
    const registerData = {
      name: "Alice",
      email: "alice@example.com",
      password: "Password1!",
      passwordConfirmation: "Password1!",
      acceptTerms: true,
    }

    it("cadastro bem-sucedido: nao autentica, nao armazena user e reseta isLoading", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse(
          {
            user: {
              id: "user-1",
              name: "Alice",
              email: "alice@example.com",
              emailVerified: null,
            },
            message: "Email de verificacao enviado",
          },
          true,
          201,
        ),
      )

      await useAuthStore.getState().register(registerData)

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/auth/register",
        expect.objectContaining({ method: "POST" }),
      )
    })

    it("email ja cadastrado: define error legivel e lanca o codigo", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse(
          {
            error: {
              code: "AUTH_EMAIL_ALREADY_EXISTS",
              message: "E-mail ja cadastrado",
            },
          },
          false,
          409,
        ),
      )

      await expect(
        useAuthStore.getState().register(registerData),
      ).rejects.toThrow("AUTH_EMAIL_ALREADY_EXISTS")

      const state = useAuthStore.getState()
      expect(state.error).toBe("E-mail ja cadastrado")
      expect(state.isLoading).toBe(false)
      expect(state.user).toBeNull()
    })

    it("falha de rede: reseta isLoading e define erro generico", async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))

      await expect(
        useAuthStore.getState().register(registerData),
      ).rejects.toThrow()

      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe("Erro ao criar conta")
    })

    it("resposta nao-JSON (500): reseta isLoading e define erro generico", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      } as unknown as Response)

      await expect(
        useAuthStore.getState().register(registerData),
      ).rejects.toThrow()

      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe("Erro ao criar conta")
    })
  })
})
