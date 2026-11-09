import { describe, expect, it } from "vitest"
import {
  MAYAN_SEALS,
  MAYAN_TONES,
  MAYAN_KIN_COUNT,
  GMT_CORRELATION_JDN,
  getMayanOndaEncantada,
  kinToSealTone,
  calculateKinMaya,
  gregorianToMayanLongCount,
} from "@/lib/horoscopes/maya"
import {
  MAYAN_SEALS as KIN_MAYA_SEALS,
  MAYAN_TONES as KIN_MAYA_TONES,
  MAYAN_KIN_COUNT as KIN_MAYA_KIN_COUNT,
  GMT_CORRELATION_JDN as KIN_MAYA_GMT,
  kinToSealTone as KIN_kinToSealTone,
  getMayanOndaEncantada as KIN_getMayanOndaEncantada,
  calculateKinMaya as KIN_calculateKinMaya,
  gregorianToMayanLongCount as KIN_gregorianToMayanLongCount,
} from "@/lib/calculations/kin-maya"

describe("maya.ts — Kin Maya exports (T110)", () => {
  it("exporta MAYAN_SEALS com 20 selos", () => {
    expect(MAYAN_SEALS).toHaveLength(20)
    expect(MAYAN_SEALS[0]).toMatchObject({
      id: 0,
      name: "Dragão Vermelho",
      meaning: "Nascimento, nutrição, ser",
      direction: "Leste",
      color: "Vermelho",
    })
    expect(MAYAN_SEALS[19]).toMatchObject({
      id: 19,
      name: "Sol Amarelo",
      meaning: "Iluminação, vida, universal",
      direction: "Sul",
      color: "Amarelo",
    })
  })

  it("exporta MAYAN_TONES com 13 tons", () => {
    expect(MAYAN_TONES).toHaveLength(13)
    expect(MAYAN_TONES[0]).toMatchObject({
      id: 1,
      name: "Magnético",
      keyword: "Unificar",
      action: "Atrair",
      power: "Propósito",
    })
    expect(MAYAN_TONES[12]).toMatchObject({
      id: 13,
      name: "Cósmico",
      keyword: "Endurecer",
      action: "Transcender",
      power: "Presença",
    })
  })

  it("exporta MAYAN_KIN_COUNT = 260", () => {
    expect(MAYAN_KIN_COUNT).toBe(260)
  })

  it("exporta GMT_CORRELATION_JDN = 584283", () => {
    expect(GMT_CORRELATION_JDN).toBe(584283)
  })

  it("exporta kinToSealTone", () => {
    expect(typeof kinToSealTone).toBe("function")
    expect(kinToSealTone(255)).toEqual({ sealIndex: 14, toneId: 8 })
    expect(() => kinToSealTone(0)).toThrow()
    expect(() => kinToSealTone(261)).toThrow()
  })

  it("exporta getMayanOndaEncantada com 9 câmaras", () => {
    expect(typeof getMayanOndaEncantada).toBe("function")
    const onda = getMayanOndaEncantada(255)
    expect(onda).toMatchObject({
      waveStartKin: 248,
      waveSeal: expect.objectContaining({ id: 7, name: "Estrela Amarela" }),
    })
    expect(onda.chambers).toHaveLength(9)
    expect(onda.chambers.map((c) => c.position)).toEqual([
      2, 3, 4, 6, 7, 8, 10, 11, 12,
    ])
    expect(onda.chambers[0]).toMatchObject({
      chamberNumber: 1,
      position: 2,
      kinNumber: 249,
      theme: "Desafio",
    })
  })

  it("exporta calculateKinMaya", () => {
    expect(typeof calculateKinMaya).toBe("function")
    const birthDate = new Date("1990-06-15T00:00:00Z")
    expect(calculateKinMaya(birthDate)).toBe(255)
  })

  it("exporta gregorianToMayanLongCount", () => {
    expect(typeof gregorianToMayanLongCount).toBe("function")
    const lc = gregorianToMayanLongCount(1990, 6, 15)
    expect(lc.kinNumber).toBe(255)
    expect(lc.tzolkinTone).toBe(8)
    expect(lc.tzolkinSeal).toBe(14)
  })
})

describe("kin-maya.ts — re-exports all maya types and functions (T110)", () => {
  it("re-exporta MAYAN_SEALS", () => {
    expect(KIN_MAYA_SEALS).toHaveLength(20)
  })

  it("re-exporta MAYAN_TONES", () => {
    expect(KIN_MAYA_TONES).toHaveLength(13)
  })

  it("re-exporta MAYAN_KIN_COUNT", () => {
    expect(KIN_MAYA_KIN_COUNT).toBe(260)
  })

  it("re-exporta GMT_CORRELATION_JDN", () => {
    expect(KIN_MAYA_GMT).toBe(584283)
  })

  it("re-exporta kinToSealTone", () => {
    expect(typeof KIN_kinToSealTone).toBe("function")
    expect(KIN_kinToSealTone(255)).toEqual({ sealIndex: 14, toneId: 8 })
  })

  it("re-exporta getMayanOndaEncantada", () => {
    expect(typeof KIN_getMayanOndaEncantada).toBe("function")
    const onda = KIN_getMayanOndaEncantada(255)
    expect(onda.chambers).toHaveLength(9)
  })

  it("re-exporta calculateKinMaya", () => {
    expect(typeof KIN_calculateKinMaya).toBe("function")
    expect(KIN_calculateKinMaya(new Date("1990-06-15T00:00:00Z"))).toBe(255)
  })

  it("re-exporta gregorianToMayanLongCount", () => {
    expect(typeof KIN_gregorianToMayanLongCount).toBe("function")
    const lc = KIN_gregorianToMayanLongCount(1990, 6, 15)
    expect(lc.kinNumber).toBe(255)
  })
})

describe("calculateKinMaya — correlação GMT 584283 (AC-11)", () => {
  it("15/06/1990 → Kin 255 (referência conhecida)", () => {
    expect(calculateKinMaya(new Date("1990-06-15T00:00:00Z"))).toBe(255)
  })

  it("retorna null para birthDate nulo/indefinido", () => {
    expect(calculateKinMaya(null)).toBeNull()
    expect(calculateKinMaya(undefined)).toBeNull()
  })
})

import { buildMayaFallback } from "../prisma/seed"

describe("Maya fallback generation (T032 / T114)", () => {
  it("gera fallback para todos os 260 kins", () => {
    for (let kin = 1; kin <= 260; kin++) {
      const fb = buildMayaFallback(kin, "2026-09")
      expect(fb.signId).toBe(String(kin))
      expect(fb.content.general).toContain(`Kin ${kin}`)
    }
  })

  it("rejeita kin fora de 1-260", () => {
    expect(() => buildMayaFallback(0, "2026-09")).toThrow()
    expect(() => buildMayaFallback(261, "2026-09")).toThrow()
  })
})
