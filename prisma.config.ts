import "dotenv/config"
import { defineConfig } from "prisma/config"

const url = process.env.DIRECT_URL || process.env.DATABASE_URL

// Allow dummy URL in CI for jobs that only need `prisma generate` (quality, type-check, build)
// These jobs don't connect to the database; they only generate the client from the schema.
const isCI = process.env.CI === "true"
const effectiveUrl =
  url || (isCI ? "postgresql://dummy:dummy@localhost:5432/dummy" : undefined)

if (!effectiveUrl) {
  throw new Error(
    "DATABASE_URL (or DIRECT_URL) is required in prisma.config.ts",
  )
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bunx tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma Postgres: CLI/migrations prefer DIRECT_URL; runtime client uses pooled DATABASE_URL.
    // Falls back to DATABASE_URL when DIRECT_URL is not set (e.g. local Docker).
    // In CI (quality/type-check/build), a dummy URL is used since these jobs only run `prisma generate`.
    url: effectiveUrl,
  },
})
