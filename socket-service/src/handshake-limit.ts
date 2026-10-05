// Rate limit de handshake por IP (revisão de segurança): janela
// deslizante em memória, por processo (como o rate-limit de registro
// em src/lib/rate-limit.ts). Confiança no IP (S1, revisão 2026-10-04):
// em produção o proxy/edge (Railway/Cloudflare) faz append do hop real
// no X-Forwarded-For, então vale a ÚLTIMA entrada (a primeira é
// fornecida pelo cliente e spoofável); sem proxy confiável
// (dev/test) o header é ignorado por completo e vale o address do
// socket.

const DEFAULT_MAX = 60
const DEFAULT_WINDOW_MS = 60_000
const PRUNE_THRESHOLD = 10_000

const attempts = new Map<string, number[]>()

export function resolveClientIp(
  headers: Record<string, string | string[] | undefined> | undefined,
  address: string | undefined,
  options: { nodeEnv?: string } = {},
): string {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV
  if (nodeEnv !== "production") {
    // Sem proxy de confiança (dev/test): XFF é 100% spoofável.
    return address ?? "unknown"
  }
  const forwarded = headers?.["x-forwarded-for"]
  const raw = Array.isArray(forwarded) ? forwarded.join(",") : forwarded
  if (typeof raw === "string" && raw.length > 0) {
    const hops = raw
      .split(",")
      .map((hop) => hop.trim())
      .filter((hop) => hop.length > 0)
    const last = hops[hops.length - 1]
    if (last !== undefined) return last
  }
  return address ?? "unknown"
}

export function allowHandshake(
  ip: string,
  options: { max?: number; windowMs?: number; now?: number } = {},
): boolean {
  const {
    max = DEFAULT_MAX,
    windowMs = DEFAULT_WINDOW_MS,
    now = Date.now(),
  } = options
  const list = (attempts.get(ip) ?? []).filter((t) => now - t < windowMs)
  if (list.length >= max) {
    attempts.set(ip, list)
    return false
  }
  list.push(now)
  attempts.set(ip, list)
  if (attempts.size > PRUNE_THRESHOLD) {
    for (const [key, times] of attempts) {
      const alive = times.filter((t) => now - t < windowMs)
      if (alive.length === 0) {
        attempts.delete(key)
      } else {
        attempts.set(key, alive)
      }
    }
  }
  return true
}

/** Testes: zera o estado do limiter. */
export function resetHandshakeLimitForTests(): void {
  attempts.clear()
}
