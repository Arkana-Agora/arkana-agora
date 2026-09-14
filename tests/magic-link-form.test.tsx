import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react"

const { mockSendMagicLink } = vi.hoisted(() => ({
  mockSendMagicLink: vi.fn(),
}))

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      sendMagicLink: mockSendMagicLink,
      isLoading: false,
      error: null,
    }
    return typeof selector === "function" ? selector(state) : state
  },
}))

import { MagicLinkForm } from "@/app/(auth)/magic-link/magic-link-form"

describe("MagicLinkForm", () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  describe("rendering", () => {
    it("renders email field", () => {
      render(<MagicLinkForm />)
      expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
    })

    it("renders informative message before submit", () => {
      render(<MagicLinkForm />)
      expect(
        screen.getByText(/enviamos um link de acesso/i),
      ).toBeInTheDocument()
    })

    it("does not show informative message after success", async () => {
      mockSendMagicLink.mockResolvedValue({ success: true, message: "OK" })
      render(<MagicLinkForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "alice@example.com" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^enviar link$/i }))

      await waitFor(() => {
        expect(
          screen.queryByText(/enviamos um link de acesso/i),
        ).not.toBeInTheDocument()
      })
    })

    it("renders submit button", () => {
      render(<MagicLinkForm />)
      expect(
        screen.getByRole("button", { name: /^enviar link$/i }),
      ).toBeInTheDocument()
    })

    it("does not render resend button before any send", () => {
      render(<MagicLinkForm />)
      expect(
        screen.queryByRole("button", {
          name: /reenviar|enviar link novamente/i,
        }),
      ).not.toBeInTheDocument()
    })

    it("renders back to login link", () => {
      render(<MagicLinkForm />)
      const link = screen.getByRole("link", { name: /entrar/i })
      expect(link).toHaveAttribute("href", "/login")
    })
  })

  describe("client-side validation", () => {
    it("shows error when submitting empty form", async () => {
      render(<MagicLinkForm />)
      fireEvent.click(screen.getByRole("button", { name: /^enviar link$/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/formato de e-mail invalido/i),
        ).toBeInTheDocument()
      })
    })

    it("shows error for invalid email format", async () => {
      render(<MagicLinkForm />)
      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "notanemail" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^enviar link$/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/formato de e-mail invalido/i),
        ).toBeInTheDocument()
      })
    })
  })

  describe("form submission", () => {
    it("calls sendMagicLink with email", async () => {
      mockSendMagicLink.mockResolvedValue({ success: true, message: "OK" })
      render(<MagicLinkForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "alice@example.com" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^enviar link$/i }))

      await waitFor(() => {
        expect(mockSendMagicLink).toHaveBeenCalledWith("alice@example.com")
      })
    })

    it("shows loading state while sending", async () => {
      let resolveSend!: (value: { success: true }) => void
      mockSendMagicLink.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSend = resolve
          }),
      )
      render(<MagicLinkForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "alice@example.com" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^enviar link$/i }))

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /enviando/i })).toBeDisabled()
      })

      await act(async () => {
        resolveSend({ success: true })
      })
    })

    it("shows success feedback with animated envelope after successful send", async () => {
      mockSendMagicLink.mockResolvedValue({ success: true, message: "OK" })
      render(<MagicLinkForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "alice@example.com" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^enviar link$/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/verifique sua caixa de entrada/i),
        ).toBeInTheDocument()
      })
      expect(screen.getByTestId("envelope-icon")).toBeInTheDocument()
    })

    it("displays error message on rate limit", async () => {
      mockSendMagicLink.mockResolvedValue({
        success: false,
        code: "AUTH_MAGIC_LINK_RATE_LIMIT",
        message: "Muitos magic links solicitados, tente novamente mais tarde",
        retryAfter: 1200,
      })
      render(<MagicLinkForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "alice@example.com" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^enviar link$/i }))

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /muitos magic links solicitados/i,
        )
      })
    })

    it("displays network error message on network failure", async () => {
      mockSendMagicLink.mockResolvedValue({
        success: false,
        code: "NETWORK_ERROR",
        message: "Erro ao enviar magic link",
      })
      render(<MagicLinkForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "alice@example.com" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^enviar link$/i }))

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /erro ao enviar magic link/i,
        )
      })
    })

    it("displays unknown error when sendMagicLink returns unknown error code", async () => {
      mockSendMagicLink.mockResolvedValue({
        success: false,
        code: "UNKNOWN_ERROR",
        message: "Erro desconhecido",
      })
      render(<MagicLinkForm />)

      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "alice@example.com" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^enviar link$/i }))

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /erro inesperado, tente novamente/i,
        )
      })
    })
  })

  describe("resend cooldown", () => {
    const flushAsync = async () => {
      await act(async () => {
        await vi.runAllTimersAsync()
      })
    }

    const deferred = () => {
      let resolveSend!: (value: { success: true }) => void
      const promise = new Promise<{ success: true }>((resolve) => {
        resolveSend = resolve
      })
      return { promise, resolveSend }
    }

    const advanceCooldown = () => {
      for (let i = 0; i < 60; i += 1) {
        act(() => {
          vi.advanceTimersByTime(1000)
        })
      }
    }

    const renderAndSubmit = () => {
      render(<MagicLinkForm />)
      fireEvent.change(screen.getByLabelText(/e-mail/i), {
        target: { value: "alice@example.com" },
      })
      fireEvent.click(screen.getByRole("button", { name: /^enviar link$/i }))
    }

    it("disables resend and shows countdown after successful send", async () => {
      vi.useFakeTimers()
      const { promise, resolveSend } = deferred()
      mockSendMagicLink.mockReturnValue(promise)
      renderAndSubmit()

      await flushAsync()
      await act(async () => {
        resolveSend({ success: true })
      })

      expect(
        screen.getByText(/verifique sua caixa de entrada/i),
      ).toBeInTheDocument()

      const resendButton = screen.getByRole("button", {
        name: /reenviar em 60s/i,
      })
      expect(resendButton).toBeDisabled()
    })

    it("re-enables resend button after the 60s cooldown", async () => {
      vi.useFakeTimers()
      const { promise, resolveSend } = deferred()
      mockSendMagicLink.mockReturnValue(promise)
      renderAndSubmit()

      await flushAsync()
      await act(async () => {
        resolveSend({ success: true })
      })

      expect(
        screen.getByRole("button", { name: /reenviar em 60s/i }),
      ).toBeDisabled()

      advanceCooldown()

      const resendButton = screen.getByRole("button", {
        name: /enviar link novamente/i,
      })
      expect(resendButton).toBeEnabled()
    })

    it("calls sendMagicLink again when resend clicked after cooldown", async () => {
      vi.useFakeTimers()
      const { promise, resolveSend } = deferred()
      mockSendMagicLink.mockReturnValue(promise)
      renderAndSubmit()

      await flushAsync()
      await act(async () => {
        resolveSend({ success: true })
      })

      advanceCooldown()

      fireEvent.click(
        screen.getByRole("button", { name: /enviar link novamente/i }),
      )

      await flushAsync()

      expect(mockSendMagicLink).toHaveBeenCalledTimes(2)
    })
  })
})
