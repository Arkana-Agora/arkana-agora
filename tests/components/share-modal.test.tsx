// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"

import { ShareModal } from "@/components/social/share-modal"
import { toast } from "sonner"

vi.mock("next-auth/react", () => ({
  getSession: vi.fn().mockResolvedValue(null),
  useSession: vi.fn(() => ({ data: null })),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const toastMock = vi.mocked(toast)

const writeText = vi.fn().mockResolvedValue(undefined)
const shareMock = vi.fn().mockResolvedValue(undefined)
const fetchMock = vi.fn()

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()

  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  })
  Object.defineProperty(navigator, "share", {
    value: shareMock,
    configurable: true,
  })
  vi.stubGlobal("fetch", fetchMock)
  if (!("createObjectURL" in URL)) {
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:mock"),
      configurable: true,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      value: vi.fn(),
      configurable: true,
    })
  }
  fetchMock.mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(["png"])),
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderModal(open = true) {
  return render(
    <ShareModal isOpen={open} onClose={vi.fn()} postId="p1" title="Meu post" />,
  )
}

describe("ShareModal social (T063)", () => {
  it("não renderiza quando fechado", () => {
    renderModal(false)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("mostra o link /post/:id e copia para a área de transferência", async () => {
    renderModal()

    const input = screen.getByDisplayValue(/\/post\/p1$/)
    expect(input).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        expect.stringMatching(/\/post\/p1$/),
      ),
    )
  })

  it("Baixar PNG busca a og-image do post e dispara o download", async () => {
    renderModal()

    fireEvent.click(screen.getByRole("button", { name: /Baixar/ }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/v1\/social\/posts\/p1\/og-image/),
        expect.anything(),
      ),
    )
  })

  it("Baixar usa o hook de sessão (single-flight) — não chama getSession", async () => {
    const { getSession } = await import("next-auth/react")
    renderModal()

    fireEvent.click(screen.getByRole("button", { name: /Baixar/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(vi.mocked(getSession)).not.toHaveBeenCalled()
  })

  it("falha ao copiar mostra toast de erro (não falha silenciosamente)", async () => {
    writeText.mockRejectedValueOnce(new Error("clipboard negado"))
    renderModal()

    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }))
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled())
  })

  it("Compartilhar usa a Web Share API com o link do post", async () => {
    renderModal()

    fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }))
    await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(1))
    expect(shareMock.mock.calls[0]![0]).toMatchObject({
      url: expect.stringMatching(/\/post\/p1$/),
      title: "Meu post",
    })
  })

  it("expõe links sociais (X, WhatsApp, Facebook) com o link codificado", () => {
    renderModal()

    const links = screen.getAllByRole("link")
    const hrefs = links.map((link) => link.getAttribute("href"))
    expect(hrefs.some((h) => h?.includes("twitter.com/intent/tweet"))).toBe(
      true,
    )
    expect(hrefs.some((h) => h?.includes("wa.me"))).toBe(true)
    expect(hrefs.some((h) => h?.includes("facebook.com/sharer"))).toBe(true)
    expect(hrefs).toHaveLength(3)
    for (const href of hrefs) {
      expect(href).toContain("%2Fpost%2Fp1")
    }
  })

  it("botão fechar chama onClose", () => {
    const onClose = vi.fn()
    render(<ShareModal isOpen onClose={onClose} postId="p1" title="x" />)

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
