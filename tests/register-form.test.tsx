import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react"

const { mockRegister } = vi.hoisted(() => ({
  mockRegister: vi.fn(),
}))

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = { register: mockRegister, isLoading: false, error: null }
    return typeof selector === "function" ? selector(state) : state
  },
}))

import { RegisterForm } from "@/app/(auth)/register/register-form"

const validData = {
  name: "Alice",
  email: "alice@example.com",
  password: "Password1!",
  passwordConfirmation: "Password1!",
  acceptTerms: true,
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/nome de exibicao/i), {
    target: { value: validData.name },
  })
  fireEvent.change(screen.getByLabelText(/e-mail/i), {
    target: { value: validData.email },
  })
  fireEvent.change(screen.getByTestId("password"), {
    target: { value: validData.password },
  })
  fireEvent.change(screen.getByTestId("passwordConfirmation"), {
    target: { value: validData.passwordConfirmation },
  })
  fireEvent.click(screen.getByRole("checkbox"))
}

describe("RegisterForm", () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders name field", () => {
      render(<RegisterForm />)
      expect(screen.getByLabelText(/nome de exibicao/i)).toBeInTheDocument()
    })

    it("renders email field", () => {
      render(<RegisterForm />)
      expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
    })

    it("renders password and confirmation fields", () => {
      render(<RegisterForm />)
      expect(screen.getByTestId("password")).toBeInTheDocument()
      expect(screen.getByTestId("passwordConfirmation")).toBeInTheDocument()
    })

    it("renders terms checkbox with accept label", () => {
      render(<RegisterForm />)
      expect(
        screen.getByRole("checkbox", { name: /aceito os termos/i }),
      ).toBeInTheDocument()
    })

    it("renders Criar conta submit button", () => {
      render(<RegisterForm />)
      expect(
        screen.getByRole("button", { name: /^criar conta$/i }),
      ).toBeInTheDocument()
    })

    it("renders back to login link", () => {
      render(<RegisterForm />)
      const link = screen.getByRole("link", { name: /^entrar$/i })
      expect(link).toHaveAttribute("href", "/login")
    })
  })

  describe("password visibility toggle", () => {
    it("password is hidden by default", () => {
      render(<RegisterForm />)
      expect(screen.getByTestId("password")).toHaveAttribute("type", "password")
    })

    it("toggles password to visible and back", () => {
      render(<RegisterForm />)
      fireEvent.click(screen.getByRole("button", { name: /mostrar senha/i }))
      expect(screen.getByTestId("password")).toHaveAttribute("type", "text")
      fireEvent.click(screen.getByRole("button", { name: /ocultar senha/i }))
      expect(screen.getByTestId("password")).toHaveAttribute("type", "password")
    })
  })

  describe("password strength indicator", () => {
    it("does not show strength meter while password is empty", () => {
      render(<RegisterForm />)
      expect(screen.queryByText(/forca da senha/i)).not.toBeInTheDocument()
    })

    it("shows Fraca for weak password", () => {
      render(<RegisterForm />)
      fireEvent.change(screen.getByTestId("password"), {
        target: { value: "abc" },
      })
      expect(screen.getByText(/fraca/i)).toBeInTheDocument()
    })

    it("shows Media for medium password", () => {
      render(<RegisterForm />)
      fireEvent.change(screen.getByTestId("password"), {
        target: { value: "Password1" },
      })
      expect(screen.getByText(/media/i)).toBeInTheDocument()
    })

    it("shows Forte for strong password", () => {
      render(<RegisterForm />)
      fireEvent.change(screen.getByTestId("password"), {
        target: { value: "Password1!" },
      })
      expect(screen.getByText(/forte/i)).toBeInTheDocument()
    })
  })

  describe("client-side validation", () => {
    it("shows errors when submitting empty form", async () => {
      render(<RegisterForm />)
      fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }))

      await waitFor(() => {
        expect(screen.getByText(/minimo 2 caracteres/i)).toBeInTheDocument()
        expect(
          screen.getByText(/formato de e-mail invalido/i),
        ).toBeInTheDocument()
        expect(screen.getByText(/pelo menos 8 caracteres/i)).toBeInTheDocument()
        expect(
          screen.getByText(/voce deve aceitar os termos/i),
        ).toBeInTheDocument()
      })
    })

    it("shows error for invalid email format", async () => {
      render(<RegisterForm />)
      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "notanemail" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/formato de e-mail invalido/i),
        ).toBeInTheDocument()
      })
    })

    it("shows error when passwords do not match", async () => {
      render(<RegisterForm />)
      fireEvent.change(screen.getByTestId("password"), {
        target: { value: "Password1!" },
      })
      fireEvent.change(screen.getByTestId("passwordConfirmation"), {
        target: { value: "Different1!" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/confirmacao de senha nao confere/i),
        ).toBeInTheDocument()
      })
    })

    it("shows error when terms checkbox is not accepted", async () => {
      render(<RegisterForm />)
      fireEvent.change(screen.getByLabelText(/nome de exibicao/i), {
        target: { value: validData.name },
      })
      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: validData.email },
      })
      fireEvent.change(screen.getByTestId("password"), {
        target: { value: validData.password },
      })
      fireEvent.change(screen.getByTestId("passwordConfirmation"), {
        target: { value: validData.passwordConfirmation },
      })
      fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/voce deve aceitar os termos/i),
        ).toBeInTheDocument()
      })
    })
  })

  describe("form submission", () => {
    it("calls register with all fields when valid", async () => {
      mockRegister.mockResolvedValue(undefined)
      render(<RegisterForm />)
      fillValidForm()
      fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }))

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith(validData)
      })
    })

    it("shows success message on successful registration", async () => {
      mockRegister.mockResolvedValue(undefined)
      render(<RegisterForm />)
      fillValidForm()
      fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/conta criada! verifique seu e-mail/i),
        ).toBeInTheDocument()
      })
    })

    it("shows loading text while registration is pending", async () => {
      let resolveRegister!: () => void
      mockRegister.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveRegister = resolve
          }),
      )
      render(<RegisterForm />)
      fillValidForm()
      fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }))

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /criando conta/i }),
        ).toBeDisabled()
      })

      resolveRegister()
      await waitFor(() => {
        expect(
          screen.getByText(/conta criada! verifique seu e-mail/i),
        ).toBeInTheDocument()
      })
    })

    it("displays error message on AUTH_EMAIL_ALREADY_EXISTS", async () => {
      mockRegister.mockRejectedValue(new Error("AUTH_EMAIL_ALREADY_EXISTS"))
      render(<RegisterForm />)
      fillValidForm()
      fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }))

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /e-mail ja cadastrado/i,
        )
      })
    })

    it("displays generic error on network failure", async () => {
      mockRegister.mockRejectedValue(new Error("NETWORK_ERROR"))
      render(<RegisterForm />)
      fillValidForm()
      fireEvent.click(screen.getByRole("button", { name: /^criar conta$/i }))

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /erro ao criar conta/i,
        )
      })
    })
  })
})
