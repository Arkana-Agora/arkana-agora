import { beforeEach, describe, expect, it, vi } from "vitest"

const pngToBuffer = vi.hoisted(() => vi.fn())
const sharpMock = vi.hoisted(() =>
  vi.fn(() => ({ png: () => ({ toBuffer: pngToBuffer }) })),
)
const imageResponseMock = vi.hoisted(() => vi.fn())
const loggerWarn = vi.hoisted(() => vi.fn())

vi.mock("sharp", () => ({ default: sharpMock }))
vi.mock("@vercel/og", () => ({ ImageResponse: imageResponseMock }))
vi.mock("@/lib/logger", () => ({
  logger: { warn: loggerWarn, info: vi.fn(), error: vi.fn() },
}))

import {
  buildPostOgSvg,
  escapeXml,
  generatePostOgImage,
  OG_HEIGHT,
  OG_WIDTH,
} from "@/lib/og-image"

const POST = {
  content: "Minha tiragem de hoje ficou incrível!",
  authorName: "Maria & Cia <amiga>",
  type: "text",
}

beforeEach(() => {
  vi.clearAllMocks()
  pngToBuffer.mockResolvedValue(Buffer.from("png-bytes"))
})

describe("escapeXml (T029)", () => {
  it("escapa os 5 caracteres XML", () => {
    expect(escapeXml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &apos;")
  })

  it("remove caracteres inválidos em XML 1.0 (controles, surrogates órfãos)", () => {
    expect(escapeXml("a\u0000b\u0007c")).toBe("abc")
    expect(escapeXml("alto\uD800baixo\uDC00")).toBe("altobaixo")
    expect(escapeXml("x\uFFFEx\uFFFF")).toBe("xx")
    // par de surrogate válido (emoji) é preservado
    expect(escapeXml("oi \u{1F600} ok")).toBe("oi \u{1F600} ok")
    // tab/CR/LF são válidos e ficam
    expect(escapeXml("a\tb\nc")).toBe("a\tb\nc")
  })
})

describe("buildPostOgSvg (T029)", () => {
  it("template 1200×630 com marca e autor escapados", () => {
    const svg = buildPostOgSvg(POST)

    expect(svg).toContain(`width="${OG_WIDTH}"`)
    expect(svg).toContain(`height="${OG_HEIGHT}"`)
    expect(OG_WIDTH).toBe(1200)
    expect(OG_HEIGHT).toBe(630)
    expect(svg).toContain("ARKANA AGORA")
    expect(svg).toContain("Maria &amp; Cia &lt;amiga&gt;")
    expect(svg).not.toContain("<amiga>")
  })

  it("não injeta HTML do conteúdo (escape) e trunca texto longo", () => {
    const svg = buildPostOgSvg({
      ...POST,
      content: `<script>alert("xss")</script> ${"palavra ".repeat(80)}`,
    })

    expect(svg).not.toContain("<script>")
    expect(svg).toContain("&lt;script&gt;")
    // conteúdo truncado em CONTENT_MAX_CHARS (280)
    const visible = svg.replace(/<[^>]+>/g, " ")
    expect(visible.length).toBeLessThan(600)
  })

  it("quebra linhas longas em até 4 linhas (tspan)", () => {
    const svg = buildPostOgSvg({
      ...POST,
      content: "palavra ".repeat(60),
    })
    const tspans = svg.match(/<tspan/g) ?? []
    expect(tspans.length).toBeGreaterThan(1)
    expect(tspans.length).toBeLessThanOrEqual(4)
  })

  it("renderiza preview quando presente", () => {
    const svg = buildPostOgSvg({ ...POST, preview: "Tiragem: Sim/Não" })
    expect(svg).toContain("Tiragem: Sim/Não")
    expect(buildPostOgSvg(POST)).not.toContain("Tiragem:")
  })

  it("aria-label escapa uma única vez (sem entidade duplicada)", () => {
    const svg = buildPostOgSvg({ ...POST, content: "Tom & Jerry" })

    expect(svg).toContain('aria-label="Tom &amp; Jerry"')
    expect(svg).not.toContain("&amp;amp;")
  })

  it("trunca por code point: emoji não vira surrogate órfão (S-N7)", () => {
    const svg = buildPostOgSvg({ ...POST, content: "\u{1F600}".repeat(300) })
    const aria = svg.match(/aria-label="([^"]*)"/)?.[1] ?? ""

    // 280 code points = 279 emoji + "…" (slice em UTF-16 cortaria no meio do par)
    expect((aria.match(/\u{1F600}/gu) ?? []).length).toBe(279)
    expect(aria).not.toMatch(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/,
    )
  })
})

describe("generatePostOgImage (T029)", () => {
  it("usa sharp como primário e devolve o PNG", async () => {
    const buffer = await generatePostOgImage(POST)

    expect(sharpMock).toHaveBeenCalledTimes(1)
    expect(pngToBuffer).toHaveBeenCalledTimes(1)
    expect(buffer).toEqual(Buffer.from("png-bytes"))
    expect(imageResponseMock).not.toHaveBeenCalled()
  })

  it("fallback @vercel/og quando o sharp falha", async () => {
    sharpMock.mockImplementationOnce(() => {
      throw new Error("sharp indisponível")
    })
    const ogBytes = new Uint8Array([1, 2, 3]).buffer
    imageResponseMock.mockReturnValueOnce({
      arrayBuffer: vi.fn().mockResolvedValue(ogBytes),
    })

    const buffer = await generatePostOgImage(POST)

    expect(buffer).toEqual(Buffer.from(ogBytes))
    expect(imageResponseMock).toHaveBeenCalledTimes(1)
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ type: "text" }),
      expect.stringContaining("@vercel/og"),
    )
  })
})
