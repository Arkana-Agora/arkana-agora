import { Resend, type CreateEmailResponse } from "resend"
import { logger } from "@/lib/logger"

const DEFAULT_FROM = "Arkana Agora <nao-responda@arkanaagora.dev>"

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function wrap(body: string): string {
  return `<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111">
    ${body}
  </body>
</html>`
}

const BUTTON_STYLE =
  "background:#4f46e5;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block"

function embedButton(url: string, label: string): string {
  const href = escapeHtml(url)
  const text = escapeHtml(label)
  return `<p><a href="${href}" style="${BUTTON_STYLE}">${text}</a></p>`
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function assertSingleRecipient(to: string): string {
  if (!EMAIL_RE.test(to) || /[,;]/.test(to)) {
    throw new Error("Destinatario de e-mail invalido")
  }
  return to
}

function assertTrustedUrl(raw: string): string {
  const production = process.env.NODE_ENV === "production"
  const base = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (!base) {
    if (production) {
      throw new Error("AUTH_URL nao configurado em producao")
    }
    return assertSameOrigin(raw, "http://localhost:3000")
  }
  return assertSameOrigin(raw, base)
}

function assertSameOrigin(raw: string, base: string): string {
  let url: URL
  let origin: URL
  try {
    url = new URL(raw)
    origin = new URL(base)
  } catch {
    throw new Error("URL de email invalida")
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error("URL de email nao pode conter userinfo")
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("Esquema de URL de email invalido")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Esquema de URL de email invalido")
  }
  if (url.origin !== origin.origin) {
    throw new Error("Origem de URL de email nao confiavel")
  }
  return raw
}

function makeSendGuard(): { skipSend: boolean; from: string } {
  const skipSend = process.env.AUTH_EMAIL_SKIP_SEND === "true"
  if (skipSend && process.env.NODE_ENV !== "development") {
    throw new Error("AUTH_EMAIL_SKIP_SEND so e permitido em desenvolvimento")
  }
  return { skipSend, from: process.env.EMAIL_FROM ?? DEFAULT_FROM }
}

const SKIPPED = Object.freeze<CreateEmailResponse>({
  data: { id: "skipped" },
  error: null,
  headers: null,
})

let resend: Resend | undefined

function getResend(): Resend {
  if (!resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) {
      throw new Error("RESEND_API_KEY nao configurado")
    }
    resend = new Resend(key)
  }
  return resend
}

function redactUrl(url: string): string {
  return url.replace(/([?&]token=)[^&\s]+/g, "$1[redacted]")
}

async function sendEmail(
  to: string,
  tag: string,
  subject: string,
  html: string,
  text: string,
): Promise<CreateEmailResponse> {
  const { skipSend, from } = makeSendGuard()
  if (skipSend) {
    logger.info(`[email:${tag}] ${redactUrl(text)}`)
    return SKIPPED
  }
  const result = await getResend().emails.send({
    from,
    to,
    subject,
    html,
    text,
  })
  if (result.error) {
    logger.error({ err: result.error }, `[email:${tag}] falhou`)
    throw new Error(`Falha ao enviar e-mail (${tag})`, {
      cause: result.error,
    })
  }
  return result
}

export async function sendVerificationEmail(
  to: string,
  { verificationUrl }: { verificationUrl: string },
): Promise<CreateEmailResponse> {
  const email = assertSingleRecipient(to)
  assertTrustedUrl(verificationUrl)
  return sendEmail(
    email,
    "verify",
    "Confirme seu email - Arkana Agora",
    wrap(
      `<h1>Boas-vindas!</h1><p>Confirme seu email para ativar sua conta.</p>${embedButton(
        verificationUrl,
        "Confirmar email",
      )}<p>Se nao foi voce, ignore este email.</p>`,
    ),
    `Confirme seu email para ativar sua conta: ${verificationUrl}`,
  )
}

export async function sendPasswordResetEmail(
  to: string,
  { resetUrl }: { resetUrl: string },
): Promise<CreateEmailResponse> {
  const email = assertSingleRecipient(to)
  assertTrustedUrl(resetUrl)
  return sendEmail(
    email,
    "reset",
    "Redefinicao de senha - Arkana Agora",
    wrap(
      `<h1>Redefinicao de senha</h1><p>Clique abaixo para redefinir sua senha.</p>${embedButton(
        resetUrl,
        "Redefinir senha",
      )}<p>O link expira em 1 hora.</p>`,
    ),
    `Redefina sua senha pelo link: ${resetUrl}`,
  )
}

export async function sendMagicLinkEmail(
  to: string,
  { url }: { url: string },
): Promise<CreateEmailResponse> {
  const email = assertSingleRecipient(to)
  assertTrustedUrl(url)
  return sendEmail(
    email,
    "magic-link",
    "Seu link de acesso - Arkana Agora",
    wrap(
      `<h1>Ola!</h1><p>Acesse sua conta pelo link abaixo.</p>${embedButton(
        url,
        "Acessar conta",
      )}<p>O link expira em 15 minutos.</p>`,
    ),
    `Acesse sua conta pelo link (expira em 15 minutos): ${url}`,
  )
}

export async function sendAccountDeletionEmail(
  to: string,
  { deleteAfterDays }: { deleteAfterDays: number },
): Promise<CreateEmailResponse> {
  const email = assertSingleRecipient(to)
  return sendEmail(
    email,
    "account-deleted",
    `Sua conta sera excluida em ${deleteAfterDays} dias - Arkana Agora`,
    wrap(
      `<h1>Exclusao de conta</h1><p>Sua conta foi marcada para exclusao e sera
permanentemente apagada apos <strong>${deleteAfterDays} dias</strong>.</p>
<p>Voce pode reverter esta decisao dentro desse periodo.</p>`,
    ),
    `Sua conta foi marcada para exclusao e sera apagada apos ${deleteAfterDays} dias. Voce pode reverter dentro desse periodo.`,
  )
}

export async function sendAccountDeletedFinalEmail(
  to: string,
  { deleteAfterDays }: { deleteAfterDays: number },
): Promise<CreateEmailResponse> {
  const email = assertSingleRecipient(to)
  return sendEmail(
    email,
    "account-hard-deleted",
    "Sua conta do Arkana Agora foi excluida definitivamente",
    wrap(
      `<h1>Conta excluida</h1><p>Conforme solicitado, seus dados pessoais foram
removidos apos o periodo de carencia de ${deleteAfterDays} dias.</p>
<p>Se esta decisao foi um engano, nenhuma acao e possivel — crie uma nova conta
para voltar a usar o Arkana Agora.</p>`,
    ),
    `Seus dados pessoais foram removidos apos o periodo de carencia de ${deleteAfterDays} dias. Se a exclusao foi um engano, crie uma nova conta.`,
  )
}
