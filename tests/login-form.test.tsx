import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react"

const { mockPush, mockLogin, mockSignIn } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockLogin: vi.fn(),
  mockSignIn: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock("next-auth/react", () => ({
  signIn: mockSignIn,
}))

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = { login: mockLogin, isLoading: false, error: null }
    return typeof selector === "function" ? selector(state) : state
  },
}))

import { LoginForm } from "@/app/(auth)/login/login-form"

describe("LoginForm", () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders email field", () => {
      render(<LoginForm />)
      expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
    })

    it("renders password field", () => {
      render(<LoginForm />)
      expect(screen.getByTestId("password")).toBeInTheDocument()
    })

    it("renders Entrar submit button", () => {
      render(<LoginForm />)
      expect(
        screen.getByRole("button", { name: /^entrar$/i }),
      ).toBeInTheDocument()
    })

    it("renders Google sign-in button", () => {
      render(<LoginForm />)
      expect(
        screen.getByRole("button", { name: /entrar com google/i }),
      ).toBeInTheDocument()
    })

    it("renders magic link link with correct href", () => {
      render(<LoginForm />)
      const link = screen.getByRole("link", { name: /entrar com magic link/i })
      expect(link).toHaveAttribute("href", "/magic-link")
    })

    it("renders forgot password link with correct href", () => {
      render(<LoginForm />)
      const link = screen.getByRole("link", { name: /esqueci minha senha/i })
      expect(link).toHaveAttribute("href", "/forgot-password")
    })

    it("renders create account link with correct href", () => {
      render(<LoginForm />)
      const link = screen.getByRole("link", { name: /criar conta/i })
      expect(link).toHaveAttribute("href", "/register")
    })
  })

  describe("password visibility toggle", () => {
    it("password is hidden by default", () => {
      render(<LoginForm />)
      expect(screen.getByTestId("password")).toHaveAttribute("type", "password")
    })

    it("toggles password to visible on button click", () => {
      render(<LoginForm />)
      fireEvent.click(screen.getByRole("button", { name: /mostrar senha/i }))
      expect(screen.getByTestId("password")).toHaveAttribute("type", "text")
    })

    it("toggles password back to hidden on second click", () => {
      render(<LoginForm />)
      const toggle = screen.getByRole("button", { name: /mostrar senha/i })
      fireEvent.click(toggle)
      fireEvent.click(screen.getByRole("button", { name: /ocultar senha/i }))
      expect(screen.getByTestId("password")).toHaveAttribute("type", "password")
    })
  })

  describe("client-side validation", () => {
    it("shows errors when submitting empty form", async () => {
      render(<LoginForm />)
      fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/formato de e-mail invalido/i),
        ).toBeInTheDocument()
        expect(screen.getByText(/senha obrigatoria/i)).toBeInTheDocument()
      })
    })

    it("shows error for invalid email format", async () => {
      render(<LoginForm />)
      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "notanemail" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/formato de e-mail invalido/i),
        ).toBeInTheDocument()
      })
    })
  })

  describe("form submission", () => {
    it("calls login with email and password", async () => {
      mockLogin.mockResolvedValue(undefined)
      render(<LoginForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "user@example.com" },
      })
      fireEvent.change(screen.getByTestId("password"), {
        target: { value: "secret123" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }))

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith("user@example.com", "secret123")
      })
    })

    it("redirects to /dashboard on successful login", async () => {
      mockLogin.mockResolvedValue(undefined)
      render(<LoginForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "user@example.com" },
      })
      fireEvent.change(screen.getByTestId("password"), {
        target: { value: "secret123" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard")
      })
    })

    it("shows loading text while login is pending", async () => {
      let resolveLogin!: () => void
      mockLogin.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveLogin = resolve
          }),
      )
      render(<LoginForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "user@example.com" },
      })
      fireEvent.change(screen.getByTestId("password"), {
        target: { value: "secret123" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }))

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /entrando/i })).toBeDisabled()
      })

      resolveLogin()
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard")
      })
    })

    it("displays error message on AUTH_INVALID_CREDENTIALS", async () => {
      mockLogin.mockRejectedValue(new Error("AUTH_INVALID_CREDENTIALS"))
      render(<LoginForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "user@example.com" },
      })
      fireEvent.change(screen.getByTestId("password"), {
        target: { value: "wrong" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }))

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /e-mail ou senha invalidos/i,
        )
      })
    })

    it("redirects to /auth/verify-email on AUTH_EMAIL_NOT_VERIFIED", async () => {
      mockLogin.mockRejectedValue(new Error("AUTH_EMAIL_NOT_VERIFIED"))
      render(<LoginForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "user@example.com" },
      })
      fireEvent.change(screen.getByTestId("password"), {
        target: { value: "secret123" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          "/auth/verify-email?email=user%40example.com",
        )
      })
    })

    it("displays generic error on network failure", async () => {
      mockLogin.mockRejectedValue(new Error("NETWORK_ERROR"))
      render(<LoginForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "user@example.com" },
      })
      fireEvent.change(screen.getByTestId("password"), {
        target: { value: "secret123" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }))

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /erro ao fazer login/i,
        )
      })
    })
  })

  describe("Google sign-in", () => {
    it("calls signIn with google when Google button clicked", async () => {
      render(<LoginForm />)
      fireEvent.click(
        screen.getByRole("button", { name: /entrar com google/i }),
      )

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith("google", {
          callbackUrl: "/dashboard",
        })
      })
    })
  })
})
