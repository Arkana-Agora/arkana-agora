/**
 * Catálogo autoritativo de gifts (T036/SC4 — SPEC-007 RF-SOC-006 exato).
 * "Moedas" do spec = Versos (S2-4); custo é o preço em Versos.
 * IDs internos são decisão de conteúdo (o spec define nome + preço, não id).
 */
export interface GiftCatalogItem {
  id: string
  name: string
  cost: number
  emoji: string
}

export const GIFT_CATALOG: readonly GiftCatalogItem[] = [
  { id: "estrela-cadente", name: "Estrela Cadente", cost: 10, emoji: "🌠" },
  { id: "rosa-mistica", name: "Rosa Mística", cost: 25, emoji: "🌹" },
  {
    id: "cristal-de-quartzo",
    name: "Cristal de Quartzo",
    cost: 50,
    emoji: "💎",
  },
  { id: "bola-de-cristal", name: "Bola de Cristal", cost: 100, emoji: "🔮" },
  { id: "coroa-astral", name: "Coroa Astral", cost: 200, emoji: "👑" },
  { id: "dragao-dourado", name: "Dragão Dourado", cost: 500, emoji: "🐉" },
] as const

export function validateGiftId(giftId: string): boolean {
  return GIFT_CATALOG.some((gift) => gift.id === giftId)
}

export function getGiftCost(giftId: string): number | null {
  return GIFT_CATALOG.find((gift) => gift.id === giftId)?.cost ?? null
}

export function getGiftById(giftId: string): GiftCatalogItem | null {
  return GIFT_CATALOG.find((gift) => gift.id === giftId) ?? null
}
