import { z } from "zod"

// Env validation do mini-service Socket.io (plano T069). Separado do
// src/lib/env.ts do Next: o socket-service roda como processo proprio e
// valida so o que ele consome. JWT_PUBLIC_KEY (RS256) substitui o
// JWT_SECRET do plano — ADR-009 manda verificar access tokens com a
// chave publica, a mesma usada por src/services/token-service.ts.

const emptyToUndefined = (value: unknown): unknown =>
  value === "" ? undefined : value

const requiredUrl = z.preprocess(
  emptyToUndefined,
  z.string().url("Deve ser uma URL válida"),
)

const socketPort = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number()
    .int("SOCKET_PORT deve ser inteiro")
    .min(1)
    .max(65535)
    .default(3003),
)

const nonEmpty = z.preprocess(
  emptyToUndefined,
  z.string().min(1, "não pode ser vazio"),
)

// REDIS_URL é OPCIONAL (revisão K): ausente/vazia → Event Bus em
// memória + sem Redis adapter (mesma semântica do runtime, que sempre
// tratou como opcional — a exigência anterior no Zod contradizia o
// fallback documentado). Inválida ainda rejeita no boot.
const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().url("Deve ser uma URL válida").optional(),
)

// Revisão R2: TTL do access token VALIDADO no boot (antes era lido de
// process.env cru em auth.ts, fora da env única). Precisa casar com o
// token-service do Next — divergir faz o maxTokenAge rejeitar tokens
// ainda válidos (ou aceitar além do TTL).
const accessTokenTtlSeconds = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number()
    .int("ACCESS_TOKEN_TTL_SECONDS deve ser inteiro")
    .positive("ACCESS_TOKEN_TTL_SECONDS deve ser positivo")
    .default(900),
)

export const socketEnvSchema = z.object({
  REDIS_URL: optionalUrl,
  SOCKET_PORT: socketPort,
  AUTH_URL: requiredUrl,
  JWT_PUBLIC_KEY: nonEmpty,
  ACCESS_TOKEN_TTL_SECONDS: accessTokenTtlSeconds,
})

export type SocketEnv = z.infer<typeof socketEnvSchema>

export function parseSocketEnv(
  raw: Record<string, string | undefined> = process.env,
): SocketEnv {
  const result = socketEnvSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")
    throw new Error(
      `socket-service: variáveis de ambiente inválidas:\n${issues}`,
    )
  }
  return result.data
}
