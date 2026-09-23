import "dotenv/config"
import { defineConfig } from "prisma/config"

const url = process.env.DIRECT_URL || process.env.DATABASE_URL

if (!url) {
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
    url,
  },
})
