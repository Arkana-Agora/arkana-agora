import { beforeEach, describe, expect, it, vi } from "vitest"

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

  describe("sendMagicLink", () => {
    it("envia magic link com sucesso: reseta isLoading, nao autentica, nao armazena user", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(
          mockJsonResponse(
            { message: "Magic link enviado se o e-mail estiver cadastrado" },
            true,
            200,
          ),
        )

      const result = await useAuthStore
        .getState()
        .sendMagicLink("alice@example.com")

      expect(result.success).toBe(true)
      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBeNull()
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/auth/magic-link",
        expect.objectContaining({ method: "POST" }),
      )
    })

    it("rate limit: retorna erro com codigo e retryAfter", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse(
          {
            error: {
              code: "AUTH_MAGIC_LINK_RATE_LIMIT",
              message:
                "Muitos magic links solicitados, tente novamente mais tarde",
              retryAfter: 1200,
            },
          },
          false,
          429,
        ),
      )

      const result = await useAuthStore
        .getState()
        .sendMagicLink("alice@example.com")
      if (result.success) throw new Error("esperado falha no envio")

      expect(result.code).toBe("AUTH_MAGIC_LINK_RATE_LIMIT")
      expect(result.retryAfter).toBe(1200)

      const state = useAuthStore.getState()
      expect(state.error).toBe(
        "Muitos magic links solicitados, tente novamente mais tarde",
      )
      expect(state.isLoading).toBe(false)
    })

    it("e-mail vazio: retorna VALIDATION_ERROR sem chamar a API", async () => {
      global.fetch = vi.fn()

      const result = await useAuthStore.getState().sendMagicLink("   ")
      if (result.success) throw new Error("esperado falha no envio")

      expect(result.code).toBe("VALIDATION_ERROR")
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it("codigo de erro desconhecido do servidor: normaliza para UNKNOWN_ERROR", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse(
          {
            error: {
              code: "SOME_NEW_SERVER_CODE",
              message: "Novo erro do servidor",
            },
          },
          false,
          500,
        ),
      )

      const result = await useAuthStore
        .getState()
        .sendMagicLink("alice@example.com")
      if (result.success) throw new Error("esperado falha no envio")

      expect(result.code).toBe("UNKNOWN_ERROR")
      expect(result.message).toBe("Novo erro do servidor")

      const state = useAuthStore.getState()
      expect(state.error).toBe("Novo erro do servidor")
      expect(state.isLoading).toBe(false)
    })

    it("falha de rede: reseta isLoading, retorna NETWORK_ERROR e mensagem amigavel", async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))

      const result = await useAuthStore
        .getState()
        .sendMagicLink("alice@example.com")
      if (result.success) throw new Error("esperado falha no envio")

      expect(result.code).toBe("NETWORK_ERROR")
      expect(result.message).toBe("Erro ao enviar magic link")

      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe("Erro ao enviar magic link")
    })

    it("resposta nao-JSON (500): reseta isLoading e define erro generico", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      } as unknown as Response)

      const result = await useAuthStore
        .getState()
        .sendMagicLink("alice@example.com")
      if (result.success) throw new Error("esperado falha no envio")

      expect(result.code).toBe("UNEXPECTED_RESPONSE")

      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe("Resposta inesperada do servidor")
    })
  })

  describe("forgotPassword", () => {
    it("e-mail vazio: retorna VALIDATION_ERROR sem chamar a API", async () => {
      global.fetch = vi.fn()

      const result = await useAuthStore.getState().forgotPassword("   ")
      if (result.success) throw new Error("esperado falha no envio")

      expect(result.code).toBe("VALIDATION_ERROR")
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it("sucesso: retorna mensagem e reseta isLoading", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse({
          message:
            "Se o e-mail estiver cadastrado, voce recebera instrucoes para redefinir sua senha",
        }),
      )

      const result = await useAuthStore
        .getState()
        .forgotPassword("alice@example.com")

      expect(result.success).toBe(true)
      if (!result.success) throw new Error("esperado sucesso")
      expect(result.message).toContain("instrucoes para redefinir sua senha")

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/auth/forgot-password",
        expect.objectContaining({ method: "POST" }),
      )

      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it("sucesso: aceita qualquer 200 com message sem depender do texto", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(
          mockJsonResponse({ message: "Link de recuperacao gerado" }),
        )

      const result = await useAuthStore
        .getState()
        .forgotPassword("alice@example.com")

      expect(result.success).toBe(true)
    })

    it("rate limit: retorna erro com codigo", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse(
          {
            error: {
              code: "AUTH_FORGOT_RATE_LIMIT",
              message:
                "Muitos pedidos de recuperacao de senha, tente novamente mais tarde",
            },
          },
          false,
          429,
        ),
      )

      const result = await useAuthStore
        .getState()
        .forgotPassword("alice@example.com")
      if (result.success) throw new Error("esperado falha no envio")

      expect(result.code).toBe("AUTH_FORGOT_RATE_LIMIT")

      const state = useAuthStore.getState()
      expect(state.error).toBe(
        "Muitos pedidos de recuperacao de senha, tente novamente mais tarde",
      )
      expect(state.isLoading).toBe(false)
    })

    it("codigo de erro desconhecido do servidor: normaliza para UNKNOWN_ERROR", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse(
          {
            error: {
              code: "SOME_NEW_SERVER_CODE",
              message: "Novo erro do servidor",
            },
          },
          false,
          500,
        ),
      )

      const result = await useAuthStore
        .getState()
        .forgotPassword("alice@example.com")
      if (result.success) throw new Error("esperado falha no envio")

      expect(result.code).toBe("UNKNOWN_ERROR")
      expect(result.message).toBe("Novo erro do servidor")

      const state = useAuthStore.getState()
      expect(state.error).toBe("Novo erro do servidor")
      expect(state.isLoading).toBe(false)
    })

    it("falha de rede: reseta isLoading, retorna NETWORK_ERROR e mensagem amigavel", async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))

      const result = await useAuthStore
        .getState()
        .forgotPassword("alice@example.com")
      if (result.success) throw new Error("esperado falha no envio")

      expect(result.code).toBe("NETWORK_ERROR")
      expect(result.message).toBe("Erro ao enviar link de recuperacao")

      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe("Erro ao enviar link de recuperacao")
    })

    it("resposta nao-JSON (500): reseta isLoading e define erro generico", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      } as unknown as Response)

      const result = await useAuthStore
        .getState()
        .forgotPassword("alice@example.com")
      if (result.success) throw new Error("esperado falha no envio")

      expect(result.code).toBe("UNEXPECTED_RESPONSE")

      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe("Resposta inesperada do servidor")
    })
  })
})
