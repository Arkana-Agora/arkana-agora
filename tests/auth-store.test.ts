import { beforeEach, describe, expect, it, vi } from "vitest"

import { useAuthStore, type User } from "@/stores/auth-store"

vi.mock("next-auth/react", () => ({
  getSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

import { getSession, signIn, signOut } from "next-auth/react"

const user: User = {
  id: "user-1",
  name: "Alice",
  email: "alice@example.com",
  displayName: null,
  role: "USER",
  plan: "FREE",
  avatar: null,
  emailVerified: true,
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
    useAuthStore.getState().clearError()
    vi.restoreAllMocks()
  })

  it("login bem-sucedido: armazena user, autentica e reseta isLoading", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(mockJsonResponse({ accessToken: "access-123", user }))

    await useAuthStore.getState().login("alice@example.com", "secret")

    const state = useAuthStore.getState()
    expect(state.user).toEqual(user)
    expect(state.user?.emailVerified).toBe(true)
    expect(state.isAuthenticated).toBe(true)
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/auth/login",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("login sem emailVerified no payload: deriva como true (S12)", async () => {
    const userWithoutFlag = {
      id: user.id,
      name: user.name,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      plan: user.plan,
      avatar: user.avatar,
    }
    global.fetch = vi.fn().mockResolvedValue(
      mockJsonResponse({
        accessToken: "access-123",
        user: userWithoutFlag,
      }),
    )

    await useAuthStore.getState().login("alice@example.com", "secret")

    const state = useAuthStore.getState()
    expect(state.user?.emailVerified).toBe(true)
    expect(state.isAuthenticated).toBe(true)
  })

  it("login com emailVerified null: nao autentica (deriva false)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockJsonResponse({
        accessToken: "access-123",
        user: { ...user, emailVerified: null },
      }),
    )

    await useAuthStore.getState().login("alice@example.com", "secret")

    const state = useAuthStore.getState()
    expect(state.user?.emailVerified).toBe(false)
    expect(state.isAuthenticated).toBe(false)
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

  it("login e-mail nao verificado: guarda user parcial sem autenticar (C9)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockJsonResponse(
        {
          error: {
            code: "AUTH_EMAIL_NOT_VERIFIED",
            message: "E-mail nao verificado",
          },
        },
        false,
        401,
      ),
    )

    await expect(
      useAuthStore.getState().login("alice@example.com", "secret"),
    ).rejects.toThrow("AUTH_EMAIL_NOT_VERIFIED")

    const state = useAuthStore.getState()
    expect(state.user).toEqual({
      email: "alice@example.com",
      emailVerified: false,
    })
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

  it("error auto-limpa apos 5 segundos", async () => {
    vi.useFakeTimers()
    try {
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

      expect(useAuthStore.getState().error).toBe("E-mail ou senha invalidos")

      vi.advanceTimersByTime(5000)
      expect(useAuthStore.getState().error).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("erro inalterado nao reinicia o timer de auto-limpeza", async () => {
    vi.useFakeTimers()
    try {
      await useAuthStore.getState().sendMagicLink("")

      vi.advanceTimersByTime(4000)

      await useAuthStore.getState().sendMagicLink("")

      expect(useAuthStore.getState().error).toBe("E-mail obrigatório")

      vi.advanceTimersByTime(1000)
      expect(useAuthStore.getState().error).toBeNull()
    } finally {
      vi.useRealTimers()
    }
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

  describe("resetPassword", () => {
    const payload = {
      token: "token-123",
      password: "NovaSenha1!",
      passwordConfirmation: "NovaSenha1!",
    }

    it("sucesso: envia token+senha, retorna success e reseta isLoading", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(
          mockJsonResponse({ message: "Senha redefinida com sucesso" }),
        )

      const result = await useAuthStore.getState().resetPassword(payload)

      expect(result.success).toBe(true)
      if (!result.success) throw new Error("esperado sucesso")
      expect(result.message).toBe("Senha redefinida com sucesso")

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/auth/reset-password",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(payload),
        }),
      )

      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it("sucesso: aceita qualquer 200 com message sem depender do texto", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(mockJsonResponse({ message: "Senha alterada" }))

      const result = await useAuthStore.getState().resetPassword(payload)

      expect(result.success).toBe(true)
    })

    it("token invalido (401): retorna AUTH_RESET_TOKEN_INVALID", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse(
          {
            error: {
              code: "AUTH_RESET_TOKEN_INVALID",
              message: "Token de redefinicao de senha invalido",
            },
          },
          false,
          401,
        ),
      )

      const result = await useAuthStore.getState().resetPassword(payload)
      if (result.success) throw new Error("esperado falha")

      expect(result.code).toBe("AUTH_RESET_TOKEN_INVALID")
      expect(result.message).toBe("Token de redefinicao de senha invalido")

      const state = useAuthStore.getState()
      expect(state.error).toBe("Token de redefinicao de senha invalido")
      expect(state.isLoading).toBe(false)
    })

    it("token expirado (410): retorna AUTH_RESET_TOKEN_EXPIRED", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse(
          {
            error: {
              code: "AUTH_RESET_TOKEN_EXPIRED",
              message:
                "Sessao de redefinicao de senha expirada, solicite um novo link",
            },
          },
          false,
          410,
        ),
      )

      const result = await useAuthStore.getState().resetPassword(payload)
      if (result.success) throw new Error("esperado falha")

      expect(result.code).toBe("AUTH_RESET_TOKEN_EXPIRED")
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it("validacao (422): retorna VALIDATION_ERROR", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Dados de entrada invalidos",
            },
          },
          false,
          422,
        ),
      )

      const result = await useAuthStore.getState().resetPassword(payload)
      if (result.success) throw new Error("esperado falha")

      expect(result.code).toBe("VALIDATION_ERROR")
    })

    it("codigo de erro desconhecido: normaliza para UNKNOWN_ERROR", async () => {
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

      const result = await useAuthStore.getState().resetPassword(payload)
      if (result.success) throw new Error("esperado falha")

      expect(result.code).toBe("UNKNOWN_ERROR")
      expect(result.message).toBe("Novo erro do servidor")
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it("falha de rede: retorna NETWORK_ERROR e mensagem amigavel", async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))

      const result = await useAuthStore.getState().resetPassword(payload)
      if (result.success) throw new Error("esperado falha")

      expect(result.code).toBe("NETWORK_ERROR")
      expect(result.message).toBe("Erro ao redefinir a senha")

      const state = useAuthStore.getState()
      expect(state.error).toBe("Erro ao redefinir a senha")
      expect(state.isLoading).toBe(false)
    })

    it("resposta nao-JSON: retorna UNEXPECTED_RESPONSE", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      } as unknown as Response)

      const result = await useAuthStore.getState().resetPassword(payload)
      if (result.success) throw new Error("esperado falha")

      expect(result.code).toBe("UNEXPECTED_RESPONSE")
      expect(useAuthStore.getState().error).toBe(
        "Resposta inesperada do servidor",
      )
    })

    it("token vazio: nao chama fetch e retorna AUTH_RESET_TOKEN_INVALID", async () => {
      global.fetch = vi.fn()

      const result = await useAuthStore.getState().resetPassword({
        token: "   ",
        password: "NovaSenha1!",
        passwordConfirmation: "NovaSenha1!",
      })
      if (result.success) throw new Error("esperado falha")

      expect(result.code).toBe("AUTH_RESET_TOKEN_INVALID")
      expect(global.fetch).not.toHaveBeenCalled()
      expect(useAuthStore.getState().isLoading).toBe(false)
    })
  })

  describe("persist", () => {
    const PERSIST_KEY = "arkana-auth"

    it("login persiste o user no localStorage", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(
          mockJsonResponse({ accessToken: "access-123", user }),
        )

      useAuthStore.setState({ user: null, isAuthenticated: false })
      await useAuthStore.getState().login("alice@example.com", "secret")

      const raw = localStorage.getItem(PERSIST_KEY)
      expect(raw).not.toBeNull()
      const persisted = JSON.parse(raw!) as { state: { user: unknown } }
      expect(persisted.state.user).toEqual(user)
    })

    it("rehydrate restaura o user e deriva isAuthenticated", async () => {
      localStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({ state: { user }, version: 0 }),
      )

      await useAuthStore.persist.rehydrate()

      const state = useAuthStore.getState()
      expect(state.user).toEqual(user)
      expect(state.isAuthenticated).toBe(true)
    })

    it("rehydrate com user parcial (C9) nao autentica", async () => {
      localStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({
          state: { user: { email: "alice@example.com", emailVerified: false } },
          version: 0,
        }),
      )

      await useAuthStore.persist.rehydrate()

      const state = useAuthStore.getState()
      expect(state.user).toEqual({
        email: "alice@example.com",
        emailVerified: false,
      })
      expect(state.isAuthenticated).toBe(false)
    })

    it("rehydrate com dado corrompido/sem shape valido: descarta o user", async () => {
      localStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({
          state: {
            user: { email: 123, emailVerified: "sim" },
            isAuthenticated: true,
          },
          version: 0,
        }),
      )

      await useAuthStore.persist.rehydrate()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
    it("rehydrate com role fora do union (adulterado): descarta o user", async () => {
      localStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({
          state: { user: { ...user, role: "SUPERADMIN" } },
          version: 0,
        }),
      )

      await useAuthStore.persist.rehydrate()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })

    it("rehydrate com shape parcial e role adulterado: descarta o user", async () => {
      localStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({
          state: {
            user: {
              email: "alice@example.com",
              emailVerified: true,
              role: "ADMIN",
            },
            isAuthenticated: true,
          },
          version: 0,
        }),
      )

      await useAuthStore.persist.rehydrate()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe("refreshSession", () => {
    it("sucesso: renova via cookie (POST sem body), popula user do servidor e mantem autenticado", async () => {
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse({
          accessToken: "access-456",
          expiresIn: 900,
          user: {
            id: "user-1",
            name: "Alice",
            email: "alice@example.com",
            displayName: null,
            role: "USER",
            plan: "FREE",
            avatar: null,
            emailVerified: true,
          },
        }),
      )

      const result = await useAuthStore.getState().refreshSession()

      expect(result).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/auth/refresh",
        expect.objectContaining({ method: "POST" }),
      )
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.user).toEqual(user)
      expect(state.isLoading).toBe(false)
    })

    it("refresh com user nao verificado: desautentica", async () => {
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse({
          accessToken: "access-456",
          user: {
            id: "user-1",
            name: "Alice",
            email: "alice@example.com",
            displayName: null,
            role: "USER",
            plan: "FREE",
            avatar: null,
            emailVerified: false,
          },
        }),
      )

      const result = await useAuthStore.getState().refreshSession()

      expect(result).toBe(true)
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
      expect(useAuthStore.getState().user?.emailVerified).toBe(false)
    })

    it("falha com 401: retorna false, limpa user e define error legivel", async () => {
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse(
          {
            error: {
              code: "AUTH_REFRESH_TOKEN_EXPIRED",
              message: "Falha ao renovar sessao",
            },
          },
          false,
          401,
        ),
      )

      const result = await useAuthStore.getState().refreshSession()

      expect(result).toBe(false)
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBeNull()
      expect(state.error).toBe("Falha ao renovar sessao")
      expect(state.isLoading).toBe(false)
    })

    it("resposta 200 sem accessToken: retorna false e limpa user", async () => {
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi.fn().mockResolvedValue(mockJsonResponse({}))

      expect(await useAuthStore.getState().refreshSession()).toBe(false)
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBeNull()
    })

    it("resposta nao-JSON: retorna false, limpa user e reseta isLoading", async () => {
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      } as unknown as Response)

      expect(await useAuthStore.getState().refreshSession()).toBe(false)
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.error).toBe("Resposta inesperada do servidor")
      expect(state.isLoading).toBe(false)
    })

    it("falha de rede (TypeError): retorna false, seta error mas preserva sessao", async () => {
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))

      expect(await useAuthStore.getState().refreshSession()).toBe(false)
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.user).toEqual(user)
      expect(state.error).toBe("Erro ao reconectar sessao")
      expect(state.isLoading).toBe(false)
    })

    it("chamadas concorrentes compartilham a mesma requisicao (single-flight)", async () => {
      let resolveFetch!: (r: Response) => void
      global.fetch = vi.fn().mockReturnValue(
        new Promise<Response>((r) => {
          resolveFetch = r
        }),
      )
      const first = useAuthStore.getState().refreshSession()
      const second = useAuthStore.getState().refreshSession()
      expect(global.fetch).toHaveBeenCalledTimes(1)
      resolveFetch(
        mockJsonResponse({
          accessToken: "access-789",
          user: {
            id: "user-1",
            name: "Alice",
            email: "alice@example.com",
            displayName: null,
            role: "USER",
            plan: "FREE",
            avatar: null,
            emailVerified: true,
          },
        }),
      )
      const [a, b] = await Promise.all([first, second])
      expect(a).toBe(true)
      expect(b).toBe(true)
    })
  })

  describe("verifyEmail", () => {
    it("sucesso: verifica email e retorna message", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(
          mockJsonResponse({ message: "Email verificado com sucesso" }),
        )

      const result = await useAuthStore
        .getState()
        .verifyEmail("valid-token-123")

      expect(result).toEqual({
        success: true,
        message: "Email verificado com sucesso",
      })
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/auth/verify-email",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "valid-token-123" }),
        }),
      )
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it("falha com 401 AUTH_EMAIL_VERIFY_INVALID: retorna false e error legivel", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse(
          {
            error: {
              code: "AUTH_EMAIL_VERIFY_INVALID",
              message: "Token de verificacao de email invalido",
            },
          },
          false,
          401,
        ),
      )

      const result = await useAuthStore.getState().verifyEmail("invalid-token")

      expect(result).toEqual({
        success: false,
        code: "AUTH_EMAIL_VERIFY_INVALID",
        message: "Token de verificacao de email invalido",
      })
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it("falha com 410 AUTH_EMAIL_VERIFY_EXPIRED: retorna false e error legivel", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse(
          {
            error: {
              code: "AUTH_EMAIL_VERIFY_EXPIRED",
              message:
                "Token de verificacao de email expirado, solicite um novo email de verificacao",
            },
          },
          false,
          410,
        ),
      )

      const result = await useAuthStore.getState().verifyEmail("expired-token")

      expect(result).toEqual({
        success: false,
        code: "AUTH_EMAIL_VERIFY_EXPIRED",
        message:
          "Token de verificacao de email expirado, solicite um novo email de verificacao",
      })
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it("token vazio: retorna false sem chamar fetch", async () => {
      const result = await useAuthStore.getState().verifyEmail("")

      expect(result).toEqual({
        success: false,
        code: "AUTH_EMAIL_VERIFY_INVALID",
        message: "Token de verificação de email inválido",
      })
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it("resposta nao-JSON: retorna false, error legivel e reseta isLoading", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      } as unknown as Response)

      const result = await useAuthStore.getState().verifyEmail("some-token")

      expect(result).toEqual({
        success: false,
        code: "UNEXPECTED_RESPONSE",
        message: "Resposta inesperada do servidor",
      })
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it("falha de rede (TypeError): retorna false com error legivel", async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))

      const result = await useAuthStore.getState().verifyEmail("some-token")

      expect(result).toEqual({
        success: false,
        code: "NETWORK_ERROR",
        message: "Erro ao verificar email",
      })
      expect(useAuthStore.getState().isLoading).toBe(false)
    })
  })

  describe("resendVerifyEmail", () => {
    it("sucesso: reenvia email e retorna message", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(
          mockJsonResponse({ message: "Email de verificacao enviado" }),
        )

      const result = await useAuthStore
        .getState()
        .resendVerifyEmail("alice@example.com")

      expect(result).toEqual({
        success: true,
        message: "Email de verificacao enviado",
      })
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/auth/verify-email/resend",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "alice@example.com" }),
        }),
      )
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it("email vazio: retorna false sem chamar fetch", async () => {
      const result = await useAuthStore.getState().resendVerifyEmail("")

      expect(result).toEqual({
        success: false,
        code: "VALIDATION_ERROR",
        message: "E-mail obrigatório",
      })
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it("resposta nao-JSON: retorna false, error legivel e reseta isLoading", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      } as unknown as Response)

      const result = await useAuthStore
        .getState()
        .resendVerifyEmail("alice@example.com")

      expect(result).toEqual({
        success: false,
        code: "UNEXPECTED_RESPONSE",
        message: "Resposta inesperada do servidor",
      })
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it("falha de rede (TypeError): retorna false com error legivel", async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))

      const result = await useAuthStore
        .getState()
        .resendVerifyEmail("alice@example.com")

      expect(result).toEqual({
        success: false,
        code: "NETWORK_ERROR",
        message: "Erro ao reenviar email de verificação",
      })
      expect(useAuthStore.getState().isLoading).toBe(false)
    })
  })

  describe("verifyMagicLink", () => {
    const magicUser = {
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      displayName: null,
      role: "USER" as const,
      plan: "FREE",
      avatar: null,
      emailVerified: true,
    }

    it("sucesso: verifica magic link, autentica usuario e retorna user", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse({
          accessToken: "access-789",
          user: magicUser,
        }),
      )

      const result = await useAuthStore
        .getState()
        .verifyMagicLink("valid-magic-token")

      expect(result).toEqual({ success: true, user: magicUser })
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/auth/magic-link/verify",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ token: "valid-magic-token" }),
        }),
      )
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.user).toEqual(magicUser)
    })

    it("falha com 401 AUTH_MAGIC_TOKEN_INVALID: retorna false e error legivel", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse(
          {
            error: {
              code: "AUTH_MAGIC_TOKEN_INVALID",
              message: "Token de magic link invalido",
            },
          },
          false,
          401,
        ),
      )

      const result = await useAuthStore
        .getState()
        .verifyMagicLink("invalid-token")

      expect(result).toEqual({
        success: false,
        code: "AUTH_MAGIC_TOKEN_INVALID",
        message: "Token de magic link invalido",
      })
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })

    it("falha com 410 AUTH_MAGIC_TOKEN_EXPIRED: retorna false e error legivel", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse(
          {
            error: {
              code: "AUTH_MAGIC_TOKEN_EXPIRED",
              message: "Token de magic link expirado",
            },
          },
          false,
          410,
        ),
      )

      const result = await useAuthStore
        .getState()
        .verifyMagicLink("expired-token")

      expect(result).toEqual({
        success: false,
        code: "AUTH_MAGIC_TOKEN_EXPIRED",
        message: "Token de magic link expirado",
      })
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })

    it("token vazio: retorna false sem chamar fetch", async () => {
      const result = await useAuthStore.getState().verifyMagicLink("")

      expect(result).toEqual({
        success: false,
        code: "AUTH_MAGIC_TOKEN_INVALID",
        message: "Token de magic link inválido",
      })
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it("resposta nao-JSON: retorna false com error legivel", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      } as unknown as Response)

      const result = await useAuthStore.getState().verifyMagicLink("some-token")

      expect(result).toEqual({
        success: false,
        code: "UNEXPECTED_RESPONSE",
        message: "Resposta inesperada do servidor",
      })
    })

    it("falha de rede (TypeError): retorna false com error legivel", async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))

      const result = await useAuthStore.getState().verifyMagicLink("some-token")

      expect(result).toEqual({
        success: false,
        code: "NETWORK_ERROR",
        message: "Erro ao verificar magic link",
      })
    })
  })

  describe("loginWithGoogle", () => {
    it("chama signIn do next-auth com google e callbackUrl /dashboard", async () => {
      vi.mocked(signIn).mockResolvedValue(undefined as never)

      useAuthStore.getState().loginWithGoogle()

      expect(signIn).toHaveBeenCalledWith("google", {
        callbackUrl: "/dashboard",
      })
    })

    it("ignora o NEXT_REDIRECT do signIn (sucesso) sem setar erro", async () => {
      vi.mocked(signIn).mockRejectedValue(new Error("NEXT_REDIRECT"))

      useAuthStore.getState().loginWithGoogle()

      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(useAuthStore.getState().error).toBeNull()
    })

    it("falha do signIn seta erro de Google", async () => {
      vi.mocked(signIn).mockRejectedValue(new Error("popup_closed_by_user"))

      useAuthStore.getState().loginWithGoogle()

      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(useAuthStore.getState().error).toBe("Erro ao entrar com Google")
    })
  })

  describe("logout", () => {
    it("envia POST /auth/logout com Bearer, encerra sessao Auth.js e limpa o estado", async () => {
      vi.mocked(getSession).mockResolvedValue({
        accessToken: "access-123",
      } as never)
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi
        .fn()
        .mockResolvedValue(mockJsonResponse({ message: "Sessao encerrada" }))

      await useAuthStore.getState().logout()

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/auth/logout",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer access-123",
          }),
        }),
      )
      expect(signOut).toHaveBeenCalledWith({ redirect: false })
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
    })

    it("sem sessao: limpa o estado e encerra sessao Auth.js sem chamar a API", async () => {
      vi.mocked(getSession).mockResolvedValue(null)
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi.fn()

      await useAuthStore.getState().logout()

      expect(global.fetch).not.toHaveBeenCalled()
      expect(signOut).toHaveBeenCalledWith({ redirect: false })
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })

    it("falha de rede: limpa o estado local mesmo assim", async () => {
      vi.mocked(getSession).mockResolvedValue({
        accessToken: "access-123",
      } as never)
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))

      await useAuthStore.getState().logout()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
    })
    it("falha do signOut nao impede a limpeza do estado local", async () => {
      vi.mocked(getSession).mockResolvedValue({
        accessToken: "access-123",
      } as never)
      vi.mocked(signOut).mockRejectedValue(new Error("signOut falhou"))
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi
        .fn()
        .mockResolvedValue(mockJsonResponse({ message: "Sessao encerrada" }))

      await useAuthStore.getState().logout()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
    })
  })

  describe("deleteAccount", () => {
    it("envia DELETE /auth/account com Bearer e { email }, encerra sessao e limpa o estado", async () => {
      vi.mocked(getSession).mockResolvedValue({
        accessToken: "access-123",
      } as never)
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi
        .fn()
        .mockResolvedValue(mockJsonResponse({ message: "Conta marcada" }))

      await useAuthStore.getState().deleteAccount("alice@example.com")

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/auth/account",
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({
            Authorization: "Bearer access-123",
          }),
          body: JSON.stringify({ email: "alice@example.com" }),
        }),
      )
      expect(signOut).toHaveBeenCalledWith({ redirect: false })
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
    })

    it("normaliza o email (trim + lowercase) antes de enviar", async () => {
      vi.mocked(getSession).mockResolvedValue({
        accessToken: "access-123",
      } as never)
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi
        .fn()
        .mockResolvedValue(mockJsonResponse({ message: "Conta marcada" }))

      await useAuthStore.getState().deleteAccount("  Alice@Example.com  ")

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/auth/account",
        expect.objectContaining({
          body: JSON.stringify({ email: "alice@example.com" }),
        }),
      )
    })

    it("falha do signOut apos excluir nao impede a limpeza do estado", async () => {
      vi.mocked(getSession).mockResolvedValue({
        accessToken: "access-123",
      } as never)
      vi.mocked(signOut).mockRejectedValue(new Error("signOut falhou"))
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi
        .fn()
        .mockResolvedValue(mockJsonResponse({ message: "Conta marcada" }))

      await useAuthStore.getState().deleteAccount("alice@example.com")

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
    })

    it("resposta HTTP de erro (401): mantem o estado e registra erro", async () => {
      vi.mocked(getSession).mockResolvedValue({
        accessToken: "access-123",
      } as never)
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse(
          {
            error: { code: "AUTH_TOKEN_INVALID", message: "Sessao expirada" },
          },
          false,
          401,
        ),
      )

      await useAuthStore.getState().deleteAccount("alice@example.com")

      const state = useAuthStore.getState()
      expect(state.user).toEqual(user)
      expect(state.isAuthenticated).toBe(true)
      expect(state.error).toBe("Erro ao excluir conta")
      expect(state.isLoading).toBe(false)
      expect(signOut).not.toHaveBeenCalled()
    })

    it("sem sessao: registra erro sem chamar a API", async () => {
      vi.mocked(getSession).mockResolvedValue(null)
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi.fn()

      await useAuthStore.getState().deleteAccount("alice@example.com")

      expect(global.fetch).not.toHaveBeenCalled()
      const state = useAuthStore.getState()
      expect(state.user).toEqual(user)
      expect(state.error).toBe("Sessao expirada, faca login novamente")
      expect(state.isLoading).toBe(false)
    })

    it("falha de rede: mantem o estado e registra erro", async () => {
      vi.mocked(getSession).mockResolvedValue({
        accessToken: "access-123",
      } as never)
      useAuthStore.setState({ user, isAuthenticated: true })
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))

      await useAuthStore.getState().deleteAccount("alice@example.com")

      const state = useAuthStore.getState()
      expect(state.user).toEqual(user)
      expect(state.isAuthenticated).toBe(true)
      expect(state.error).toBe("Erro ao excluir conta")
      expect(state.isLoading).toBe(false)
    })
  })
})
