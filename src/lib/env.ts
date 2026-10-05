import { z } from "zod"

// Validação de env do Sprint 2 (plano T022). Uso lazy via getEnv() — não
// quebra boot de features ainda não consumidas: só SOCKET_PORT tem default.
// R2/AI ficam opcionais aqui e são exigidas no ponto de uso (src/lib/r2.ts).

const emptyToUndefined = (value: unknown): unknown =>
  value === "" ? undefined : value

const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().url("Deve ser uma URL válida").optional(),
)

const optionalText = z.preprocess(
  emptyToUndefined,
  z.string().min(1).optional(),
)

export const envSchema = z.object({
  REDIS_URL: optionalUrl,
  SOCKET_PORT: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .int("SOCKET_PORT deve ser inteiro")
      .min(1)
      .max(65535)
      .default(3003),
  ),
  AI_HOROSCOPE_API_KEY: optionalText,
  AI_HOROSCOPE_MODEL: optionalText,
  SHARP_IGNORE_GLOBAL_LIBVIPS: z.preprocess(
    emptyToUndefined,
    z.enum(["true", "false"]).optional(),
  ),
  MODERATION_BLOCKED_WORDS: optionalText,
  R2_ACCOUNT_ID: optionalText,
  R2_ACCESS_KEY_ID: optionalText,
  R2_SECRET_ACCESS_KEY: optionalText,
  R2_BUCKET_NAME: optionalText,
  NEXT_PUBLIC_R2_PUBLIC_URL: optionalUrl,
  // Revisão P: validada no boot (instrumentation getEnv) — formato também
  // checado no client por src/lib/socket-url.ts (resolveSocketUrl).
  // `localhost:3003` sem esquema passa no url() do Zod (protocolo
  // "localhost:"), então o refine de protocolo é obrigatório.
  NEXT_PUBLIC_WS_URL: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .url("Deve ser uma URL válida")
      .refine(
        (value) =>
          ["http:", "https:", "ws:", "wss:"].includes(new URL(value).protocol),
        { message: "protocolo deve ser http, https, ws ou wss" },
      )
      .optional(),
  ),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(
  raw: Record<string, string | undefined> = process.env,
): Env {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`)
  }
  return result.data
}

let cached: Env | null = null

export function getEnv(): Env {
  if (cached === null) {
    cached = parseEnv()
  }
  return cached
}

export function resetEnvCache(): void {
  cached = null
}
