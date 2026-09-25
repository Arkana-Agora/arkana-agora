export function csrfCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Host-csrf-token"
    : "csrf-token"
}

export function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")
}
