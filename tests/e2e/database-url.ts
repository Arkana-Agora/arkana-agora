import { parse as parseDotenv } from "dotenv"

// Guard de banco do E2E (Crítico 9 da revisão): as specs têm operações
// destrutivas (cleanupUser, deleteMany de verificationToken) e o
// processo do Playwright herda DATABASE_URL remoto do .env — o
// .env.local (banco local, mesma precedência do Next) é a única fonte
// aceitável, e mesmo assim só se for host local.

export function isLocalDatabaseUrl(url: string): boolean {
  try {
    // scheme não-especial (postgresql:) mantém colchetes em IPv6
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "")
    return host === "localhost" || host === "127.0.0.1" || host === "::1"
  } catch {
    return false
  }
}

function assertLocalDatabaseUrl(url: string): void {
  if (!isLocalDatabaseUrl(url)) {
    throw new Error(
      `[e2e] DATABASE_URL nao-local recusado (${url.replace(/:[^:@/]*@/, ":***@")}) — ` +
        "as specs destrutivas so rodam contra o banco local do .env.local",
    )
  }
}

export function resolveE2eDatabaseUrl(options: {
  envLocalContent: string | undefined
  envDatabaseUrl: string | undefined
}): string {
  const fromFile =
    options.envLocalContent !== undefined
      ? parseDotenv(options.envLocalContent).DATABASE_URL
      : undefined
  const url = fromFile || options.envDatabaseUrl
  if (!url) {
    throw new Error(
      "[e2e] DATABASE_URL nao definido — crie .env.local com o banco local",
    )
  }
  assertLocalDatabaseUrl(url)
  return url
}
