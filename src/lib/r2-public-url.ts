// Base pública do R2 + helpers de chave — single source para server e
// client (módulo seguro para browser: sem SDK da AWS, apenas `process.env`
// `NEXT_PUBLIC_*`, inlined no build pelo Next).

export const R2_PUBLIC_FALLBACK_URL = "https://r2.arkanaagora.com"

export function getR2PublicUrl(): string {
  return process.env.NEXT_PUBLIC_R2_PUBLIC_URL || R2_PUBLIC_FALLBACK_URL
}

/**
 * Extrai a chave R2 (`avatars/…`, `posts/…`) de uma URL pública de avatar,
 * seja qual for a origem que a gerou (host legado, base vazia com `/`
 * inicial, storage temporário): o caminho absoluto após o host É a chave.
 */
export function r2KeyFromPublicUrl(url: string): string {
  if (/^https?:\/\//.test(url)) {
    try {
      return new URL(url).pathname.replace(/^\/+/, "")
    } catch {
      return url.replace(/^\/+/, "")
    }
  }
  return url.replace(/^\/+/, "")
}
