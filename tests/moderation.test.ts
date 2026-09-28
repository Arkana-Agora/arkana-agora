import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { checkContent } from "@/lib/moderation"
import { resetEnvCache } from "@/lib/env"

const PREVIOUS = process.env.MODERATION_BLOCKED_WORDS

function setBlockedWords(value: string | undefined): void {
  if (value === undefined) delete process.env.MODERATION_BLOCKED_WORDS
  else process.env.MODERATION_BLOCKED_WORDS = value
  resetEnvCache()
}

beforeEach(() => {
  setBlockedWords("golpe, spam, clique aqui")
})

afterEach(() => {
  if (PREVIOUS === undefined) delete process.env.MODERATION_BLOCKED_WORDS
  else process.env.MODERATION_BLOCKED_WORDS = PREVIOUS
  resetEnvCache()
})

describe("checkContent (T025)", () => {
  it("permite conteúdo sem palavras bloqueadas", () => {
    expect(checkContent("Uma tiragem maravilhosa hoje!")).toEqual({
      allowed: true,
      flaggedWords: [],
    })
  })

  it("bloqueia palavra da lista (case-insensitive)", () => {
    const result = checkContent("Isso é um GoLpE comprovado")
    expect(result.allowed).toBe(false)
    expect(result.flaggedWords).toEqual(["golpe"])
  })

  it("acumula múltiplas palavras bloqueadas na ordem da lista", () => {
    const result = checkContent("spam grátis: clique aqui agora")
    expect(result.allowed).toBe(false)
    expect(result.flaggedWords).toEqual(["spam", "clique aqui"])
  })

  it("não casa substrings (fronteira de palavra)", () => {
    setBlockedWords("golpe")
    expect(checkContent("golpista e desgolpe").allowed).toBe(true)
    expect(checkContent("golpe").allowed).toBe(false)
  })

  it("sem MODERATION_BLOCKED_WORDS → tudo permitido", () => {
    setBlockedWords(undefined)
    expect(checkContent("qualquer coisa")).toEqual({
      allowed: true,
      flaggedWords: [],
    })
  })

  it("ignora entradas vazias do CSV", () => {
    setBlockedWords(" , golpe , ")
    expect(checkContent("limpo").allowed).toBe(true)
    expect(checkContent("golpe").allowed).toBe(false)
  })

  it("fronteiras Unicode: casa palavra acentuada e não casa substrings", () => {
    setBlockedWords("ação")
    expect(checkContent("que ação horrível").allowed).toBe(false)
    expect(checkContent("reação e ações").allowed).toBe(true)
  })

  it("normaliza NFKC (fullwidth) e remove zero-width entre as letras", () => {
    setBlockedWords("golpe")
    expect(checkContent("\uFF47\uFF4F\uFF4C\uFF50\uFF45").allowed).toBe(false) // fullwidth
    expect(checkContent("go\u200Blpe").allowed).toBe(false) // zero-width space
    expect(checkContent("go\u00ADlpe").allowed).toBe(false) // soft-hyphen
  })

  it("case-insensitive Unicode (maiúscula acentuada)", () => {
    setBlockedWords("golpe")
    expect(checkContent("Um GoLpE gravíssimo").allowed).toBe(false)
    expect(checkContent("GOLPE").allowed).toBe(false)
  })
})
