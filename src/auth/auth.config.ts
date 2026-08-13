import type { NextAuthConfig } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"

if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  if (!process.env.AUTH_URL) {
    throw new Error(
      "AUTH_URL é obrigatório em produção — previne host-header poisoning do magic link",
    )
  }
  if (!process.env.AUTH_URL.startsWith("https://")) {
    throw new Error("AUTH_URL deve usar https:// em produção")
  }
}

const smtpConfigured =
  Boolean(process.env.SMTP_HOST) ||
  Boolean(process.env.SMTP_URL) ||
  Boolean(process.env.SMTP_USER)

const smtpServer = smtpConfigured
  ? (process.env.SMTP_URL ?? {
      host: process.env.SMTP_HOST ?? "localhost",
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS ?? "",
          }
        : undefined,
    })
  : { host: "localhost", port: 25, ignoreTLS: true }

const emailFrom =
  process.env.EMAIL_FROM ?? "Arkana Agora <nao-responda@arkanaagora.dev>"

const callbacks = {
  signIn: () => true,
  jwt({ token, user }) {
    if (user?.id) {
      token.userId = user.id
    }
    return token
  },
  session({ session, token }) {
    if (token.userId) {
      session.user.id = token.userId
    }
    return session
  },
} satisfies NonNullable<NextAuthConfig["callbacks"]>

export const authCallbacks = callbacks

export const authConfig = {
  trustHost: process.env.AUTH_TRUST_HOST !== "false",
  pages: {
    signIn: "/login",
  },
  providers: [
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? GoogleProvider({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
          allowDangerousEmailAccountLinking: true,
        })
      : null,
    EmailProvider({
      from: emailFrom,
      maxAge: 15 * 60,
      server: smtpServer,
      sendVerificationRequest: async ({ identifier, url }) => {
        if (process.env.AUTH_EMAIL_SKIP_SEND === "true") {
          if (process.env.NODE_ENV !== "development") {
            throw new Error(
              "AUTH_EMAIL_SKIP_SEND só é permitido em desenvolvimento",
            )
          }
          console.log(`[auth:magic-link] ${identifier}: ${url}`)
          return
        }
        if (!smtpConfigured) {
          throw new Error(
            "SMTP não configurado (SMTP_HOST/SMTP_URL). Defina AUTH_EMAIL_SKIP_SEND=true em dev para logar o link.",
          )
        }
        const { createTransport } = await import("nodemailer")
        const transport = createTransport(smtpServer)
        await transport.sendMail({
          to: identifier,
          from: emailFrom,
          subject: "Seu link de acesso — Arkana Agora",
          text: `Acesse este link para entrar na sua conta: ${url}\nO link expira em 15 minutos.`,
          html: `<p>Acesse o link abaixo para entrar na sua conta:</p><p><a href="${url}">${url}</a></p><p>O link expira em 15 minutos.</p>`,
        })
      },
    }),
  ].filter(
    (provider): provider is NonNullable<typeof provider> => provider !== null,
  ),
  callbacks,
} satisfies NextAuthConfig
