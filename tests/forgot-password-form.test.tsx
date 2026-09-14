import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"

const { mockForgotPassword } = vi.hoisted(() => ({
  mockForgotPassword: vi.fn(),
}))

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      forgotPassword: mockForgotPassword,
      isLoading: false,
      error: null,
    }
    return typeof selector === "function" ? selector(state) : state
  },
}))

import { ForgotPasswordForm } from "@/app/(auth)/forgot-password/forgot-password-form"

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe("rendering", () => {
    it("renders email field", () => {
      render(<ForgotPasswordForm />)
      expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
    })

    it("renders submit button", () => {
      render(<ForgotPasswordForm />)
      expect(
        screen.getByRole("button", { name: /enviar link de recuperacao/i }),
      ).toBeInTheDocument()
    })

    it("renders back to login link", () => {
      render(<ForgotPasswordForm />)
      const link = screen.getByRole("link", { name: /entrar/i })
      expect(link).toHaveAttribute("href", "/login")
    })
  })

  describe("client-side validation", () => {
    it("does not call API when email is invalid", async () => {
      render(<ForgotPasswordForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "invalido" },
      })
      fireEvent.click(
        screen.getByRole("button", { name: /enviar link de recuperacao/i }),
      )

      expect(
        await screen.findByText(/formato de e-mail invalido/i),
      ).toBeInTheDocument()
      expect(screen.getByLabelText(/e-mail/i)).toHaveAttribute(
        "aria-invalid",
        "true",
      )
      expect(mockForgotPassword).not.toHaveBeenCalled()
    })

    it("does not call API when email is empty", async () => {
      render(<ForgotPasswordForm />)

      fireEvent.click(
        screen.getByRole("button", { name: /enviar link de recuperacao/i }),
      )

      expect(
        await screen.findByText(/formato de e-mail invalido/i),
      ).toBeInTheDocument()
      expect(mockForgotPassword).not.toHaveBeenCalled()
    })
  })

  describe("submission", () => {
    it("calls forgotPassword and shows success feedback with instructions", async () => {
      mockForgotPassword.mockResolvedValue({
        success: true,
        message:
          "Se o e-mail estiver cadastrado, voce recebera instrucoes para redefinir sua senha",
      })
      render(<ForgotPasswordForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "alice@example.com" },
      })
      fireEvent.click(
        screen.getByRole("button", { name: /enviar link de recuperacao/i }),
      )

      await waitFor(() => {
        expect(screen.getByRole("status")).toBeInTheDocument()
      })
      expect(mockForgotPassword).toHaveBeenCalledWith("alice@example.com")

      expect(
        screen.getByText(/instrucoes para redefinir sua senha/i),
      ).toBeInTheDocument()
      const backLink = screen.getByRole("link", {
        name: /voltar ao login/i,
      })
      expect(backLink).toHaveAttribute("href", "/login")
      expect(
        screen.queryByRole("button", { name: /enviar link de recuperacao/i }),
      ).not.toBeInTheDocument()
    })

    it("shows loading state while submitting", async () => {
      let resolveSubmit!: (value: { success: true; message: string }) => void
      mockForgotPassword.mockReturnValue(
        new Promise((resolve) => {
          resolveSubmit = resolve
        }),
      )
      render(<ForgotPasswordForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "alice@example.com" },
      })
      fireEvent.click(
        screen.getByRole("button", { name: /enviar link de recuperacao/i }),
      )

      expect(screen.getByRole("button", { name: /enviando/i })).toBeDisabled()

      await act(async () => {
        resolveSubmit({ success: true, message: "OK" })
      })
    })

    it("maps AUTH_FORGOT_RATE_LIMIT to friendly message", async () => {
      mockForgotPassword.mockResolvedValue({
        success: false,
        code: "AUTH_FORGOT_RATE_LIMIT",
        message:
          "Muitos pedidos de recuperacao de senha, tente novamente mais tarde",
      })
      render(<ForgotPasswordForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "alice@example.com" },
      })
      fireEvent.click(
        screen.getByRole("button", { name: /enviar link de recuperacao/i }),
      )

      expect(
        await screen.findByText(/muitos pedidos de recuperacao/i),
      ).toBeInTheDocument()
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    })

    it("maps network failure to friendly message", async () => {
      mockForgotPassword.mockResolvedValue({
        success: false,
        code: "NETWORK_ERROR",
        message: "Erro ao enviar link de recuperacao",
      })
      render(<ForgotPasswordForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "alice@example.com" },
      })
      fireEvent.click(
        screen.getByRole("button", { name: /enviar link de recuperacao/i }),
      )

      expect(
        await screen.findByText(/erro ao enviar link de recuperacao/i),
      ).toBeInTheDocument()
    })

    it("maps unknown error code to generic message", async () => {
      mockForgotPassword.mockResolvedValue({
        success: false,
        code: "UNKNOWN_ERROR",
        message: "Novo erro do servidor",
      })
      render(<ForgotPasswordForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "alice@example.com" },
      })
      fireEvent.click(
        screen.getByRole("button", { name: /enviar link de recuperacao/i }),
      )

      expect(
        await screen.findByText(/erro inesperado, tente novamente/i),
      ).toBeInTheDocument()
    })
  })
})
