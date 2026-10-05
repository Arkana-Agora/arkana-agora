// Revisão M: visibilidade de rooms cliente-joináveis. O socket-service
// não tem Prisma (Dockerfile copia só socket-service/), então a checagem
// é via API do Next com o Bearer do próprio socket:
//   GET {AUTH_URL}/api/v1/social/posts/{id}
//   200        → visível (true)
//   401/403/404 → não visível/não existe (false → room_forbidden)
//   5xx/rede/timeout → false (fail-closed — S2, revisão 2026-10-04:
//     incerteza nunca abre join; o polling cobre a indisponibilidade
//     sem expor room privada durante um erro de infra).
// `comment:{id}` não tem endpoint de comentário hoje (T077/Phase 3) →
// false (não verificável → negado; T077 adicionará a checagem).
// O tipo mantém `null` para verificadores customizados (opção
// roomAccess.verify do server) — consumidores devem tratar null como
// "não verificado" e NEGAR (server.ts: `if (!allowed)`).

export type RoomAccessResult = boolean | null

export async function verifyRoomAccess(input: {
  room: string
  token: string
  authUrl: string
}): Promise<RoomAccessResult> {
  const match = /^post:(.+)$/.exec(input.room)
  const rawId = match?.[1]
  if (rawId === undefined || rawId.length === 0) return false
  try {
    const response = await fetch(
      `${input.authUrl}/api/v1/social/posts/${encodeURIComponent(rawId)}`,
      {
        headers: { Authorization: `Bearer ${input.token}` },
        signal: AbortSignal.timeout(1500),
      },
    )
    return response.status === 200
  } catch {
    return false
  }
}
