import type { Card } from "@/types/tarot"
import { createHash } from "crypto"

function mulberry32(seed: string): () => number {
  const hash = createHash("sha256").update(seed).digest()
  let a = hash.readUInt32BE(0)
  let b = hash.readUInt32BE(4)

  return () => {
    a |= 0
    b |= 0
    a = (a + b) | 0
    b = (b + 1) | 0
    let t = (a ^ (a >>> 16)) | 0
    t = Math.imul(t, 0x45d9f3b) | 0
    t = (t ^ (t >>> 16)) | 0
    return (t >>> 0) / 0x100000000
  }
}

export function shuffleDeck<T extends Card>(cards: T[], seed: string): T[] {
  const result = [...cards]
  const rng = mulberry32(seed)

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const temp = result[i]!
    result[i] = result[j]!
    result[j] = temp
  }

  return result
}

export { mulberry32 as createSeededRNG }
