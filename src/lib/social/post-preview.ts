// Revisão V3: truncamento do preview realtime (T070/T088) — fonte única
// para POST /social/posts (emitNewPost) e o fallback de polling
// (use-socket): string vazia/ausente vira null, senão corta em 120.

export const POST_PREVIEW_MAX = 120

export function postPreview(content: string | null | undefined): string | null {
  if (typeof content !== "string" || content.length === 0) return null
  return content.slice(0, POST_PREVIEW_MAX)
}
