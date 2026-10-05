// Fronteira cliente/servidor da janela de polling (revisão I-1): as
// constantes vivem em src/lib porque o cliente não pode importar de
// @/app/api — polling-utils (servidor), use-socket e notifications-provider
// (cliente) importam daqui, garantindo que o guard e os cursors do hook
// falem a mesma língua (janela default e tamanho de página).

/** Janela default de `since` quando o parâmetro ausente (5 min). */
export const POLLING_DEFAULT_SINCE_MS = 5 * 60_000

/**
 * Teto de amplitude do `since` (integridade C1): `createdAt: { gt }` sem
 * piso escaneia o índice de ponta a ponta a cada poll. Um `since` mais
 * antigo que isto é limitado ao teto no servidor (clamp — em vez de 422,
 * para o cliente com cursor velho (aba aberta >24h offline) se auto-
 * curar avançando o cursor, sem ficar preso em erro).
 */
export const POLLING_MAX_SINCE_MS = 24 * 60 * 60_000

/**
 * Máximo de rows por resposta de polling. Página cheia (= este valor)
 * sinaliza backlog: o hook trava o `since` e drena com `until` antes de
 * avançar o cursor.
 */
export const POLLING_TAKE = 50
