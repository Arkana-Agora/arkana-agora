import type { NextAuthConfig } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { createRefreshSession, signAccessToken } from "@/services/token-service"
import { enrichUserFromOAuthProfile } from "@/services/account-service"

if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  if (!process.env.AUTH_URL) {
    throw new Error(
      `AUTH_URL é obrigatório em produção — previne host-header poisoning do magic link (NODE_ENV=${process.env.NODE_ENV}, VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}, AUTH_URL_in_env=${"AUTH_URL" in process.env}, AUTH_URL_empty=${process.env.AUTH_URL === ""})`,
    )
  }
  const authUrl = (() => {
    try {
      return new URL(process.env.AUTH_URL)
    } catch {
      return null
    }
  })()
  // WHATWG normaliza `https:/evil.com` e `https:\\evil.com` para um host
  // válido — o scheme sozinho nao basta. Exigir a forma scheme://authority
  // (origin bem-formada) na string bruta, alem do protocolo https, e rejeitar
  // credenciais/userinfo e query/fragment que corromperiam os links de
  // verificacao construidos por concatenacao.
  const AUTH_URL_ORIGIN_RE = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/\s]+/
  const authUrlScheme = authUrl?.protocol ?? "invalid-url"
  const authUrlHost = authUrl?.host ?? ""
  const authUrlWellFormed = AUTH_URL_ORIGIN_RE.test(process.env.AUTH_URL)
  const authUrlHasCredentials = Boolean(authUrl?.username || authUrl?.password)
  const authUrlHasQueryFragment = Boolean(authUrl?.search || authUrl?.hash)

  let authUrlOriginIssue = "ok"
  if (authUrlScheme !== "https:" || authUrlHost === "" || !authUrlWellFormed) {
    authUrlOriginIssue = "malformado"
  } else if (authUrlHasCredentials) {
    authUrlOriginIssue = "com-credential"
  } else if (authUrlHasQueryFragment) {
    authUrlOriginIssue = "com-query-fragment"
  }

  if (authUrlOriginIssue !== "ok") {
    throw new Error(
      `AUTH_URL deve usar https:// com origin válido em produção (got scheme=${authUrlScheme}, host=${authUrlHost || "(vazio)"}, origin=${authUrlOriginIssue})`,
    )
  }
  if (!process.env.AUTH_SECRET) {
    throw new Error(
      `AUTH_SECRET environment variable is required for production operation (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`,
    )
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

export interface CustomAuth {
  accessToken: string
  refreshToken: string
  emittedAt: number
}

async function emitCustomTokens(
  userId: string,
  provider?: string,
): Promise<CustomAuth | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      plan: true,
      tokenVersion: true,
      isActive: true,
      deletedAt: true,
      emailVerified: true,
      provider: true,
    },
  })

  if (user === null || user.isActive === false || user.deletedAt !== null) {
    logger.warn(
      { userId },
      "[auth:oauth-callback] inactive or deleted account - no custom token emission",
    )
    return null
  }

  if (user.emailVerified === null && provider === "google") {
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    })
  }

  const accessToken = await signAccessToken({
    id: user.id,
    role: user.role,
    plan: user.plan,
    tokenVersion: user.tokenVersion,
  })
  const session = await createRefreshSession(user.id, {})

  return {
    accessToken,
    refreshToken: session.rawToken,
    emittedAt: Date.now(),
  }
}

const events: NonNullable<NextAuthConfig["events"]> = {
  async signIn({ user, account, profile }) {
    if (account?.provider !== "google" || !user?.id) return
    try {
      await enrichUserFromOAuthProfile(user.id, profile)
    } catch (err) {
      logger.warn(
        { err, userId: user.id },
        "[auth:signin] falha ao enriquecer perfil Google",
      )
    }
  },
}

const callbacks = {
  signIn: () => true,
  async jwt({ token, user, account }) {
    if (user?.id) {
      token.userId = user.id
      if (!token.customAuth) {
        const customAuth = await emitCustomTokens(user.id, account?.provider)
        if (customAuth !== null) {
          token.customAuth = customAuth
        }
      }
    }
    return token
  },
  session({ session, token }) {
    if (token.userId) {
      session.user.id = token.userId
    }
    const customAuth = token.customAuth as CustomAuth | undefined
    if (customAuth?.accessToken) {
      ;(session as typeof session & { accessToken?: string }).accessToken =
        customAuth.accessToken
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
      : undefined,
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
  ].filter(Boolean) as unknown[] as NextAuthConfig["providers"],
  callbacks,
  events,
} satisfies NextAuthConfig
