const DEV_SOCKET_URL = "http://localhost:3003"
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "ws:", "wss:"])

/**
 * Revisão P: fonte única da URL do socket-service para o cliente.
 * - ausente/vazia em DEV/TEST → default de dev (`""` não pode vazar para
 *   `io()` — `??` não trata string vazia);
 * - ausente/vazia em PRODUÇÃO → `null`: o caller desliga o realtime e o
 *   fallback de polling cobre posts/notificações. Nunca localhost em
 *   produção — o handshake do socket.io envia o access token RS256, que
 *   iria para qualquer processo local ouvindo a 3003 (C1 revisão nextjs);
 * - protocolo fora de http/https/ws/wss (ex.: `localhost:3003` sem
 *   esquema, que o `URL` "aceita" como protocolo `localhost:`) → erro
 *   ruidoso: quebrar realtime é melhor do que silenciar;
 * - normaliza barra final.
 * No build, o Next inlina `NEXT_PUBLIC_WS_URL`; o formato também é
 * validado no boot pelo Zod (`src/lib/env.ts` — revisão P).
 */
export function resolveSocketUrl(
  raw: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string | null {
  if (raw === undefined || raw === "") {
    if (nodeEnv === "production") return null
    return DEV_SOCKET_URL
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`NEXT_PUBLIC_WS_URL invalida: ${JSON.stringify(raw)}`)
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error(
      `NEXT_PUBLIC_WS_URL invalida (protocolo ${url.protocol}): ${raw}`,
    )
  }
  return url.toString().replace(/\/$/, "")
}
