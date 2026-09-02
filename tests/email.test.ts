import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const EMAIL_PATH = "@/lib/email/email"

const sendMock = vi.fn()

vi.mock("resend", () => {
  class MockResend {
    emails = {
      send: sendMock,
    }
  }
  return { Resend: MockResend }
})

function expectFromDefaults(payload: unknown): void {
  const p = payload as {
    from: string
    to: string
    subject: string
    html: string
    text: string
  }
  expect(p.to).toBe("user@example.com")
  expect(p.from).toBe("Arkana Agora <nao-responda@arkanaagora.dev>")
  expect(typeof p.subject).toBe("string")
  expect(p.html).toContain("http://www.w3.org/1999/xhtml")
  expect(p.html).toContain("</html>")
  expect(typeof p.text).toBe("string")
}

function payloadAt(index: number) {
  return sendMock.mock.calls[index]![0] as {
    from: string
    to: string
    subject: string
    html: string
    text: string
  }
}

beforeEach(() => {
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: "mock-email-id" }, error: null })
  vi.stubEnv("AUTH_EMAIL_SKIP_SEND", "false")
  vi.stubEnv("NODE_ENV", "test")
  vi.stubEnv("RESEND_API_KEY", "re_mock")
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")
  delete process.env.EMAIL_FROM
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("email helpers (T3 - Resend provider)", () => {
  it("sendVerificationEmail envia com link e from padrao", async () => {
    const { sendVerificationEmail } = await import(EMAIL_PATH)
    const res = await sendVerificationEmail("user@example.com", {
      verificationUrl: "http://localhost:3000/api/v1/auth/verify-email?token=x",
    })
    expect(res.data?.id).toBe("mock-email-id")
    expect(sendMock).toHaveBeenCalledTimes(1)
    expectFromDefaults(payloadAt(0))
  })

  it("sendPasswordResetEmail envia com link de redefinicao", async () => {
    const { sendPasswordResetEmail } = await import(EMAIL_PATH)
    const res = await sendPasswordResetEmail("user@example.com", {
      resetUrl: "http://localhost:3000/api/v1/auth/reset-password?token=y",
    })
    expect(res.data?.id).toBe("mock-email-id")
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(payloadAt(0).html).toContain("redefini")
  })

  it("sendMagicLinkEmail envia url de acesso no html", async () => {
    const { sendMagicLinkEmail } = await import(EMAIL_PATH)
    const res = await sendMagicLinkEmail("user@example.com", {
      url: "http://localhost:3000/api/auth/callback/email?token=z",
    })
    expect(res.data?.id).toBe("mock-email-id")
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(payloadAt(0).html).toContain(
      "http://localhost:3000/api/auth/callback/email",
    )
  })

  it("honra EMAIL_FROM quando definido", async () => {
    vi.stubEnv("EMAIL_FROM", "No Reply <no-reply@arkanaagora.dev>")
    const { sendMagicLinkEmail } = await import(EMAIL_PATH)
    await sendMagicLinkEmail("user@example.com", {
      url: "http://localhost:3000/api/auth/callback/email?token=z",
    })
    expect(payloadAt(0).from).toBe("No Reply <no-reply@arkanaagora.dev>")
  })

  it("escapeHtml evita quebrar o atributo href", async () => {
    const { sendMagicLinkEmail } = await import(EMAIL_PATH)
    const malicious =
      'http://localhost:3000/api/auth/callback/email?x="><img src=x onerror=alert(1)>'
    await sendMagicLinkEmail("user@example.com", { url: malicious })
    const html = payloadAt(0).html
    expect(html).toContain("&quot;&gt;")
    expect(html).not.toContain('"><img')
  })

  it("rejeita URL de origem nao confiavel", async () => {
    const { sendMagicLinkEmail } = await import(EMAIL_PATH)
    await expect(
      sendMagicLinkEmail("user@example.com", {
        url: "https://evil.example.com/phish",
      }),
    ).rejects.toThrow(/Origem/)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("rejeita destinatario invalido", async () => {
    const { sendMagicLinkEmail } = await import(EMAIL_PATH)
    await expect(
      sendMagicLinkEmail("not-an-email", {
        url: "http://localhost:3000/api/auth/callback/email?token=z",
      }),
    ).rejects.toThrow(/Destinatario/)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("AUTH_EMAIL_SKIP_SEND=true nao chama resend em dev", async () => {
    vi.stubEnv("AUTH_EMAIL_SKIP_SEND", "true")
    vi.stubEnv("NODE_ENV", "development")
    const { sendMagicLinkEmail } = await import(EMAIL_PATH)
    const res = await sendMagicLinkEmail("user@example.com", {
      url: "http://localhost:3000/api/auth/callback/email?token=z",
    })
    expect(sendMock).not.toHaveBeenCalled()
    expect(res.data?.id).toBe("skipped")
  })

  it("AUTH_EMAIL_SKIP_SEND=true fora de dev lanca erro", async () => {
    vi.stubEnv("AUTH_EMAIL_SKIP_SEND", "true")
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AUTH_URL", "https://arkanaagora.dev")
    const { sendMagicLinkEmail } = await import(EMAIL_PATH)
    await expect(
      sendMagicLinkEmail("user@example.com", {
        url: "https://arkanaagora.dev/api/auth/callback/email?token=z",
      }),
    ).rejects.toThrow(/AUTH_EMAIL_SKIP_SEND/)
  })

  it("lanca erro quando resend retorna error", async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { message: "boom" } })
    const { sendMagicLinkEmail } = await import(EMAIL_PATH)
    await expect(
      sendMagicLinkEmail("user@example.com", {
        url: "http://localhost:3000/api/auth/callback/email?token=z",
      }),
    ).rejects.toThrow(/Falha ao enviar/)
  })

  it("rejeita esquema nao http(s)", async () => {
    const { sendMagicLinkEmail } = await import(EMAIL_PATH)
    await expect(
      sendMagicLinkEmail("user@example.com", {
        url: "javascript:alert(1)",
      }),
    ).rejects.toThrow(/Esquema/)
    await expect(
      sendMagicLinkEmail("user@example.com", {
        url: "data:text/html;base64,PHNjcmlwdD4=",
      }),
    ).rejects.toThrow(/Esquema/)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("rejeita URL com userinfo", async () => {
    const { sendMagicLinkEmail } = await import(EMAIL_PATH)
    await expect(
      sendMagicLinkEmail("user@example.com", {
        url: "http://evil.com@localhost:3000/api/auth/callback/email",
      }),
    ).rejects.toThrow(/userinfo/)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("skip-send em dev funciona sem RESEND_API_KEY", async () => {
    delete process.env.RESEND_API_KEY
    vi.stubEnv("AUTH_EMAIL_SKIP_SEND", "true")
    vi.stubEnv("NODE_ENV", "development")
    const { sendMagicLinkEmail } = await import(EMAIL_PATH)
    const res = await sendMagicLinkEmail("user@example.com", {
      url: "http://localhost:3000/api/auth/callback/email?token=z",
    })
    expect(sendMock).not.toHaveBeenCalled()
    expect(res.data?.id).toBe("skipped")
  })

  it("skip-send redige o token no log", async () => {
    vi.stubEnv("AUTH_EMAIL_SKIP_SEND", "true")
    vi.stubEnv("NODE_ENV", "development")
    const { logger } = await import("@/lib/logger")
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger)
    try {
      const { sendMagicLinkEmail } = await import(EMAIL_PATH)
      await sendMagicLinkEmail("user@example.com", {
        url: "http://localhost:3000/api/auth/callback/email?token=super-secret",
      })
      expect(sendMock).not.toHaveBeenCalled()
      const logged = infoSpy.mock.calls.map((c) => c.join(" ")).join(" ")
      expect(logged).toContain("[email:magic-link]")
      expect(logged).not.toContain("super-secret")
    } finally {
      infoSpy.mockRestore()
    }
  })
})
