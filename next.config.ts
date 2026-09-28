import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"

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
