import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "pino"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.arkanaagora.com.br",
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
