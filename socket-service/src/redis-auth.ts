import { createBusRedisClient } from "./bus"
import { logger } from "./lib/logger"
import { createRedisUrlResolver } from "./lib/redis-url"

// Espelho de tokenVersion (ADR-009): mesma chave/keyword do
// src/services/token-service.ts (`auth:tokenVersion:{userId}`, TTL do
// access token). O container do socket-service não tem Prisma
// (Dockerfile copia só socket-service/), então o check é só contra o
// Redis e cache miss é fail-open — revogação efetiva chega pelo kick
// do Event Bus (publishAuthKick) e pela expiração do access token.

export const TOKEN_VERSION_KEY_PREFIX = "auth:tokenVersion:"

let client: ReturnType<typeof createBusRedisClient> | null = null

// Fonte única (revisão K): o server configura com a env validada; sem
// configuração explícita (fora do createSocketServer) cai em process.env.
// Helper compartilhado com bus (revisão de consistência) — estado por
// instância, os testes resetam cada módulo de forma independente.
const authRedisUrl = createRedisUrlResolver()

export function configureRedisAuth(url: string | undefined): void {
  authRedisUrl.configure(url)
}

function resolveRedisUrl(): string | undefined {
  return authRedisUrl.resolve()
}

async function getClient(url: string) {
  if (client === null) {
    const next = createBusRedisClient(url)
    next.on("error", (err: Error) => {
      logger.warn({ err }, "[socket-auth] erro no Redis de auth")
    })
    await next.connect()
    client = next
  }
  return client
}

/**
 * Lê o espelho de tokenVersion. Retorna null em qualquer falha
 * (Redis fora, miss, valor inválido) — fail-open documentado acima.
 */
export async function getCachedTokenVersion(
  userId: string,
): Promise<number | null> {
  const url = resolveRedisUrl()
  if (!url) return null
  try {
    const redis = await getClient(url)
    const raw = await redis.get(`${TOKEN_VERSION_KEY_PREFIX}${userId}`)
    if (raw === null) return null
    const parsed = Number(raw)
    return Number.isInteger(parsed) ? parsed : null
  } catch (err) {
    logger.warn(
      { err },
      "[socket-auth] cache de tokenVersion indisponível — fail-open",
    )
    // Conexão pode ter ficado presa: descarta e refaz na próxima chamada.
    try {
      client?.disconnect()
    } catch {
      // já fechado
    }
    client = null
    return null
  }
}

/** Testes: derruba o cliente Redis singleton e a configuração. */
export function resetRedisAuthForTests(): void {
  authRedisUrl.reset()
  try {
    client?.disconnect()
  } catch {
    // já fechado
  }
  client = null
}
