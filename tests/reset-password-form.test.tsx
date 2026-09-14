import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"

const { mockResetPassword, mockRouter } = vi.hoisted(() => ({
  mockResetPassword: vi.fn(),
  mockRouter: { replace: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}))

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      resetPassword: mockResetPassword,
      isLoading: false,
      error: null,
    }
    return typeof selector === "function" ? selector(state) : state
  },
}))

import { ResetPasswordForm } from "@/app/(auth)/reset-password/reset-password-form"

const STRONG_PASSWORD = "NovaSenha1!"

function fillPasswords(
  password: string = STRONG_PASSWORD,
  confirmation: string = password,
) {
  fireEvent.change(screen.getByLabelText(/^nova senha$/i), {
    target: { value: password },
  })
  fireEvent.change(screen.getByLabelText(/confirmar nova senha/i), {
    target: { value: confirmation },
  })
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  describe("rendering", () => {
    it("renders password and confirmation fields", () => {
      render(<ResetPasswordForm token="token-123" />)
      expect(screen.getByLabelText(/^nova senha$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirmar nova senha/i)).toBeInTheDocument()
    })

    it("renders submit button", () => {
      render(<ResetPasswordForm token="token-123" />)
      expect(
        screen.getByRole("button", { name: /redefinir senha/i }),
      ).toBeInTheDocument()
    })

    it("passwords use new-password autocomplete", () => {
      render(<ResetPasswordForm token="token-123" />)
      expect(screen.getByLabelText(/^nova senha$/i)).toHaveAttribute(
        "autoComplete",
        "new-password",
      )
      expect(screen.getByLabelText(/confirmar nova senha/i)).toHaveAttribute(
        "autoComplete",
        "new-password",
      )
    })
  })

  describe("client-side validation", () => {
    it("does not call API when password is weak", async () => {
      render(<ResetPasswordForm token="token-123" />)
      fillPasswords("abc")
      fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }))

      expect(
        await screen.findByText(/pelo menos 8 caracteres/i),
      ).toBeInTheDocument()
      expect(mockResetPassword).not.toHaveBeenCalled()
    })

    it("does not call API when confirmation does not match", async () => {
      render(<ResetPasswordForm token="token-123" />)
      fillPasswords(STRONG_PASSWORD, "OutraSenha1!")
      fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }))

      expect(
        await screen.findByText(/confirmacao de senha nao confere/i),
      ).toBeInTheDocument()
      expect(mockResetPassword).not.toHaveBeenCalled()
    })
  })

  describe("submission", () => {
    it("calls resetPassword with token and values then redirects to login after 2s", async () => {
      vi.useFakeTimers()
      mockResetPassword.mockResolvedValue({
        success: true,
        message: "Senha redefinida com sucesso",
      })
      render(<ResetPasswordForm token="token-123" />)
      fillPasswords()
      fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }))

      await act(async () => {})

      expect(mockResetPassword).toHaveBeenCalledWith({
        token: "token-123",
        password: STRONG_PASSWORD,
        passwordConfirmation: STRONG_PASSWORD,
      })
      expect(screen.getByRole("status")).toHaveTextContent(
        /senha redefinida com sucesso/i,
      )
      expect(mockRouter.replace).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(mockRouter.replace).toHaveBeenCalledWith("/login")
    })

    it("shows success and redirects even when the API message is empty", async () => {
      vi.useFakeTimers()
      mockResetPassword.mockResolvedValue({ success: true, message: "" })
      render(<ResetPasswordForm token="token-123" />)
      fillPasswords()
      fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }))

      await act(async () => {})

      const status = screen.getByRole("status")
      expect(status).toHaveTextContent(/senha redefinida com sucesso/i)

      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(mockRouter.replace).toHaveBeenCalledWith("/login")
    })

    it("does not redirect after unmount before the 2s delay elapses", async () => {
      vi.useFakeTimers()
      mockResetPassword.mockResolvedValue({ success: true, message: "OK" })
      const view = render(<ResetPasswordForm token="token-123" />)
      fillPasswords()
      fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }))

      await act(async () => {})
      expect(screen.getByRole("status")).toBeInTheDocument()

      await act(async () => {
        view.unmount()
      })

      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(mockRouter.replace).not.toHaveBeenCalled()
    })

    it("shows loading state while submitting", async () => {
      let resolveSubmit!: (value: { success: true; message: string }) => void
      mockResetPassword.mockReturnValue(
        new Promise((resolve) => {
          resolveSubmit = resolve
        }),
      )
      render(<ResetPasswordForm token="token-123" />)
      fillPasswords()
      fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }))

      expect(
        screen.getByRole("button", { name: /redefinindo/i }),
      ).toBeDisabled()

      await act(async () => {
        resolveSubmit({ success: true, message: "OK" })
      })
    })

    it("maps invalid token error to friendly message", async () => {
      mockResetPassword.mockResolvedValue({
        success: false,
        code: "AUTH_RESET_TOKEN_INVALID",
        message: "Token invalido",
      })
      render(<ResetPasswordForm token="token-123" />)
      fillPasswords()
      fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }))

      expect(
        await screen.findByText(/link de redefinicao de senha invalido/i),
      ).toBeInTheDocument()
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    })

    it("maps expired token error to friendly message", async () => {
      mockResetPassword.mockResolvedValue({
        success: false,
        code: "AUTH_RESET_TOKEN_EXPIRED",
        message:
          "Sessao de redefinicao de senha expirada, solicite um novo link",
      })
      render(<ResetPasswordForm token="token-123" />)
      fillPasswords()
      fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }))

      expect(
        await screen.findByText(/solicite um novo link/i),
      ).toBeInTheDocument()
    })

    it("maps network failure to friendly message", async () => {
      mockResetPassword.mockResolvedValue({
        success: false,
        code: "NETWORK_ERROR",
        message: "Erro ao redefinir a senha",
      })
      render(<ResetPasswordForm token="token-123" />)
      fillPasswords()
      fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }))

      expect(
        await screen.findByText(/erro ao redefinir a senha/i),
      ).toBeInTheDocument()
    })

    it("maps unknown error code to generic message", async () => {
      mockResetPassword.mockResolvedValue({
        success: false,
        code: "UNKNOWN_ERROR",
        message: "Novo erro do servidor",
      })
      render(<ResetPasswordForm token="token-123" />)
      fillPasswords()
      fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }))

      expect(
        await screen.findByText(/erro inesperado, tente novamente/i),
      ).toBeInTheDocument()
    })
  })
})
