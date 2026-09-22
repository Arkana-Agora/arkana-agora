import { createHash } from "crypto"

export function generateSeed(): string {
  return createHash("sha256")
    .update(crypto.getRandomValues(new Uint8Array(32)))
    .digest("hex")
}
