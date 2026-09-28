import { describe, expect, it } from "vitest"

import {
  linkifyMentionsHashtags,
  parseHashtags,
  parseMentions,
} from "@/lib/social/mentions"

describe("parseMentions (T031)", () => {
  it("extrai usernames únicos sem @ e na ordem", () => {
    expect(parseMentions("oi @maria e @joao, depois @MARIA de novo")).toEqual([
      "maria",
      "joao",
    ])
  })

  it("não trata e-mail como menção", () => {
    expect(parseMentions("escreva para contato@empresa.com")).toEqual([])
    expect(parseMentions("user@dominio @valida")).toEqual(["valida"])
  })

  it("ignora usernames fora do formato (curto/caractere inválido)", () => {
    expect(parseMentions("@ab @ma-rio @ok_123")).toEqual(["ok_123"])
  })

  it("string vazia → []", () => {
    expect(parseMentions("")).toEqual([])
  })
})

describe("parseHashtags (T031)", () => {
  it("extrai tags em lowercase únicas", () => {
    expect(parseHashtags("#Tarot #tarot #Astrologia")).toEqual([
      "tarot",
      "astrologia",
    ])
  })

  it("aceita tags com acento e número", () => {
    expect(parseHashtags("#signos #t2026")).toEqual(["signos", "t2026"])
  })

  it("ignora # isolado e palavra com # no meio", () => {
    expect(parseHashtags("só # e a#b")).toEqual([])
  })
})

describe("linkifyMentionsHashtags (T031)", () => {
  it("gera âncoras para menções e hashtags", () => {
    const html = linkifyMentionsHashtags("oi @maria, veja #tarot")
    expect(html).toContain('<a href="/perfil/maria">@maria</a>')
    expect(html).toContain('<a href="/explorar?tag=tarot">#tarot</a>')
  })

  it("escapa HTML do texto (XSS)", () => {
    const html = linkifyMentionsHashtags('<script>alert("x")</script> @maria')
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain('<a href="/perfil/maria">@maria</a>')
  })

  it("preserva texto sem menções/hashtags", () => {
    expect(linkifyMentionsHashtags("texto simples")).toBe("texto simples")
  })
})
