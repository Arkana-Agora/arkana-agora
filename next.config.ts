import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"

// Revisão I-e: NEXT_PUBLIC_WS_URL é inlined em BUILD time — `next build`
// de produção sem a variável deixa o client SEM endpoint WebSocket: em
// produção resolveSocketUrl devolve null e o realtime fica desabilitado
// (fallback de polling; C1 revisão nextjs — nunca localhost, que
// mandaria o access token para um processo local). WARN, não erro: o CI
// (ci.yml) builda sem a var e não pode quebrar. Ver
// docs/02-architecture/deployment.md (seção de build).
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_WS_URL) {
  console.warn(
    "[next.config] NEXT_PUBLIC_WS_URL ausente no build de produção — " +
      "o client NÃO abrirá socket: resolveSocketUrl devolve null em " +
      "produção e o realtime fica desabilitado (fallback de polling cobre " +
      "posts/notificações). Defina a variável ANTES de `next build` " +
      "(inlined no bundle; ver docs/02-architecture/deployment.md).",
  )
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "pino"],
  async headers() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "header",
            key: "accept",
            // `has.value` vira regex ancorada (^…$) em prepare-destination —
            // "text/html" puro NÃO casa com o Accept real do browser
            // ("text/html,application/xhtml+xml,…"). `text/html.*` cobre.
            value: "text/html.*",
          },
        ],
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Clickjacking (review): deny framing em qualquer origem.
          // base-uri/object-src fecham injection de <base>/<object>
          // (review S-I8); img-src cobre avatar/CDN/inline data:.
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; img-src 'self' https: data:",
          },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.arkanaagora.com.br",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
    ],
    minimumCacheTTL: 60,
  },
}

if (!process.env.VERCEL) {
  nextConfig.output = "standalone"
}

const authToken = process.env.SENTRY_AUTH_TOKEN || ""

export default withSentryConfig(nextConfig, {
  org: "arkana-agora",
  project: "arkana-agora",
  authToken,
  silent: true,
  widenClientFileUpload: true,
})
