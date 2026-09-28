const MENTION_RE = /(^|[^\w@])@([A-Za-z0-9_]{3,30})\b/g
const HASHTAG_RE = /(^|[^\p{L}\p{N}_])#(\p{L}[\p{L}\p{N}_]{0,29})/gu

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Usernames únicos citados no texto (sem `@`, na ordem de primeira ocorrência). */
export function parseMentions(text: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const match of text.matchAll(MENTION_RE)) {
    const username = match[2]!
    const key = username.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(username)
  }
  return result
}

/** Tags únicas em lowercase (sem `#`, na ordem de primeira ocorrência). */
export function parseHashtags(text: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const match of text.matchAll(HASHTAG_RE)) {
    const tag = match[2]!.toLowerCase()
    if (seen.has(tag)) continue
    seen.add(tag)
    result.push(tag)
  }
  return result
}

/**
 * Texto → HTML seguro com âncoras de menção (`/perfil/:username`) e hashtag
 * (`/explorar?tag=`). Todo o texto é HTML-escaped antes do linkify (XSS).
 */
export function linkifyMentionsHashtags(text: string): string {
  const escaped = escapeHtml(text)
  return escaped
    .replace(
      MENTION_RE,
      (_match, prefix: string, username: string) =>
        `${prefix}<a href="/perfil/${username}">@${username}</a>`,
    )
    .replace(
      HASHTAG_RE,
      (_match, prefix: string, tag: string) =>
        `${prefix}<a href="/explorar?tag=${encodeURIComponent(tag.toLowerCase())}">#${tag}</a>`,
    )
}
