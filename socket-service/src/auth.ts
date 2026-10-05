import { createPublicKey, type KeyObject } from "node:crypto"
import { jwtVerify } from "jose"

import { getCachedTokenVersion } from "./redis-auth"

// Verificação de access token para conexões Socket.io. RS256 com a
// chave pública (ADR-009) — a mesma chave que src/services/token-service.ts
// usa para assinar/verificar; o JWT_SECRET do plano T069 está desatualizado.
// Além da assinatura, checa a claim tokenVersion contra o espelho Redis
// (revogação via bumpTokenVersion/logout/soft-delete) — cache miss é
// fail-open porque o processo não tem Prisma (ver redis-auth.ts).

// Revisão I-d/R2: idade máxima do token = TTL do access token — passado
// pela env VALIDADA do socket-service (`env.ACCESS_TOKEN_TTL_SECONDS`,
// parseSocketEnv; `process.env` cru não é lido aqui) + 60s de folga —
// nenhum token válido é rejeitado; iat SEMPRE emitido
// (token-service.setIssuedAt). `iss`/`aud` NÃO são verificados porque o
// token-service não os emite (decisão: adicionar a checagem invalidaria
// todos os tokens vivos; registrar a emissão de iss/aud é tarefa do
// token-service, não do handshake).
const CLOCK_TOLERANCE_SECONDS = 30

// Revisão I-d: a chave pública é imutável em runtime — parse do PEM é
// caro e o handshake acontece por conexão. Cache por PEM (rotação troca
// a string → nova entrada; entradas antigas morrem com o processo).
const publicKeyCache = new Map<string, KeyObject>()

function cachedPublicKey(publicKeyPem: string): KeyObject {
  const hit = publicKeyCache.get(publicKeyPem)
  if (hit !== undefined) {
    return hit
  }
  const key = createPublicKey(publicKeyPem)
  publicKeyCache.set(publicKeyPem, key)
  return key
}

export interface SocketAuthClaims {
  userId: string
  /** exp em epoch ms — usado na revalidação periódica do servidor. */
  tokenExpiresAt: number
  tokenVersion: number
}

export async function verifySocketToken(
  token: string,
  publicKeyPem: string,
  accessTokenTtlSeconds: number,
): Promise<SocketAuthClaims> {
  const publicKey = cachedPublicKey(publicKeyPem)
  let payload: {
    sub?: unknown
    tokenVersion?: unknown
    exp?: unknown
  }
  try {
    const result = await jwtVerify(token, publicKey, {
      algorithms: ["RS256"],
      maxTokenAge: `${accessTokenTtlSeconds + 60}s`,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    })
    payload = result.payload
  } catch {
    // assinatura inválida, expirada, idade além do TTL ou skew aceitável
    throw new Error("token_invalido")
  }

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("token_sem_sub")
  }
  if (
    typeof payload.tokenVersion !== "number" ||
    !Number.isInteger(payload.tokenVersion)
  ) {
    throw new Error("token_sem_version")
  }
  if (typeof payload.exp !== "number") {
    throw new Error("token_sem_exp")
  }

  const cached = await getCachedTokenVersion(payload.sub)
  if (cached !== null && cached !== payload.tokenVersion) {
    throw new Error("token_revogado")
  }

  return {
    userId: payload.sub,
    tokenExpiresAt: payload.exp * 1000,
    tokenVersion: payload.tokenVersion,
  }
}
