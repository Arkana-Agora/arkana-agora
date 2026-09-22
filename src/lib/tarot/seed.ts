import { createHash } from "crypto"

export function generateSeed(
  userId?: string,
  deckId?: string,
  timestamp?: number,
): string {
  if (userId && deckId && timestamp !== undefined) {
    const input = `${userId}:${deckId}:${timestamp}`
    return createHash("sha256").update(input).digest("hex")
  }

  return createHash("sha256")
    .update(crypto.getRandomValues(new Uint8Array(32)))
    .digest("hex")
}
