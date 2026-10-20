/** Timestamp relativo em pt-BR ("agora mesmo", "há 5 min", "há 2 h", "há 3 d"). */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const diff = now - Date.parse(iso)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "agora mesmo"
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `há ${days} d`
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}
