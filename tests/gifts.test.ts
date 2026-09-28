import { describe, expect, it } from "vitest"

import {
  GIFT_CATALOG,
  getGiftById,
  getGiftCost,
  validateGiftId,
} from "@/lib/social/gifts"

describe("GIFT_CATALOG (T036/SPEC-007 RF-SOC-006)", () => {
  it("contém os 6 presentes exatos do spec com preços exatos", () => {
    expect(GIFT_CATALOG).toHaveLength(6)
    expect(GIFT_CATALOG.map((gift) => [gift.name, gift.cost])).toEqual([
      ["Estrela Cadente", 10],
      ["Rosa Mística", 25],
      ["Cristal de Quartzo", 50],
      ["Bola de Cristal", 100],
      ["Coroa Astral", 200],
      ["Dragão Dourado", 500],
    ])
  })

  it("ids são únicos e em kebab-case", () => {
    const ids = GIFT_CATALOG.map((gift) => gift.id)
    expect(new Set(ids).size).toBe(6)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it("cada presente tem emoji e nome não vazio", () => {
    for (const gift of GIFT_CATALOG) {
      expect(gift.emoji.length).toBeGreaterThan(0)
      expect(gift.name.length).toBeGreaterThan(0)
    }
  })
})

describe("getGiftCost / validateGiftId (T036)", () => {
  it("retorna o custo de gifts válidos", () => {
    expect(getGiftCost("estrela-cadente")).toBe(10)
    expect(getGiftCost("dragao-dourado")).toBe(500)
    expect(getGiftCost("coroa-astral")).toBe(200)
  })

  it("retorna null para gift inexistente", () => {
    expect(getGiftCost("unicornio")).toBeNull()
    expect(validateGiftId("unicornio")).toBe(false)
    expect(validateGiftId("")).toBe(false)
  })

  it("getGiftById devolve o item completo", () => {
    expect(getGiftById("bola-de-cristal")).toMatchObject({
      id: "bola-de-cristal",
      name: "Bola de Cristal",
      cost: 100,
    })
    expect(getGiftById("inexistente")).toBeNull()
  })

  it("todos os ids do catálogo são válidos", () => {
    for (const gift of GIFT_CATALOG) {
      expect(validateGiftId(gift.id)).toBe(true)
      expect(getGiftCost(gift.id)).toBe(gift.cost)
    }
  })
})
