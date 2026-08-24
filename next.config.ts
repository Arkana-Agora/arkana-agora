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

export default withSentryConfig(nextConfig, {
  silent: true,
  widenClientFileUpload: true,
})
