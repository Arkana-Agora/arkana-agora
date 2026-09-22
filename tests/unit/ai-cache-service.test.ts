import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  findCachedInterpretation,
  saveInterpretation,
} from "@/lib/ai/cache-service"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    interpretation: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
const mockFindUnique = vi.mocked(prisma.interpretation.findUnique)
const mockCreate = vi.mocked(prisma.interpretation.create)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("findCachedInterpretation", () => {
  it("returns cached interpretation when hash matches", async () => {
    const cached = {
      id: "interp-1",
      content: "Interpretacao cacheada",
      wasCached: true,
      modelVersion: "gpt-4o-2024-08-06",
      tokensUsed: 0,
    }
    mockFindUnique.mockResolvedValue(cached as never)

    const result = await findCachedInterpretation("abc123hash")
    expect(result).toEqual(cached)
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { cacheHash: "abc123hash" },
      select: {
        id: true,
        content: true,
        wasCached: true,
        modelVersion: true,
        tokensUsed: true,
      },
    })
  })

  it("returns null when no cache hit", async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await findCachedInterpretation("nonexistent")
    expect(result).toBeNull()
  })
})

describe("saveInterpretation", () => {
  it("creates interpretation record", async () => {
    const created = {
      id: "interp-new",
      readingId: "reading-1",
      userId: "user-1",
      mode: "general",
      mood: "reflexivo",
      content: "Interpretacao completa",
      cacheHash: "hash123",
      modelVersion: "gpt-4o-2024-08-06",
      tokensUsed: 500,
      wasCached: false,
    }
    mockCreate.mockResolvedValue(created as never)

    const result = await saveInterpretation({
      readingId: "reading-1",
      userId: "user-1",
      mode: "general",
      mood: "reflexivo",
      content: "Interpretacao completa",
      cacheHash: "hash123",
      modelVersion: "gpt-4o-2024-08-06",
      tokensUsed: 500,
    })

    expect(result).toEqual(created)
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        readingId: "reading-1",
        userId: "user-1",
        mode: "general",
        mood: "reflexivo",
        question: null,
        content: "Interpretacao completa",
        cacheHash: "hash123",
        modelVersion: "gpt-4o-2024-08-06",
        tokensUsed: 500,
        wasCached: false,
      },
    })
  })

  it("includes question when provided", async () => {
    mockCreate.mockResolvedValue({ id: "new" } as never)

    await saveInterpretation({
      readingId: "reading-1",
      userId: "user-1",
      mode: "yesno",
      question: "Vou passar?",
      content: "Sim",
      cacheHash: "hash456",
      modelVersion: "gpt-4o-2024-08-06",
      tokensUsed: 200,
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ question: "Vou passar?" }),
      }),
    )
  })
})
