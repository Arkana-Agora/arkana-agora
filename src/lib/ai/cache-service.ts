import { prisma } from "@/lib/prisma"

interface CachedInterpretation {
  id: string
  content: string
  wasCached: boolean
  modelVersion: string
  tokensUsed: number
}

export async function findCachedInterpretation(
  cacheHash: string,
  userId?: string,
): Promise<CachedInterpretation | null> {
  if (userId) {
    const result = await prisma.interpretation.findFirst({
      where: { cacheHash, userId },
      select: {
        id: true,
        content: true,
        wasCached: true,
        modelVersion: true,
        tokensUsed: true,
      },
    })
    return result
  }

  return prisma.interpretation.findUnique({
    where: { cacheHash },
    select: {
      id: true,
      content: true,
      wasCached: true,
      modelVersion: true,
      tokensUsed: true,
    },
  })
}

interface SaveInterpretationInput {
  readingId: string
  userId: string
  mode: string
  mood?: string | null
  question?: string | null
  content: string
  cacheHash: string
  modelVersion: string
  tokensUsed: number
}

export async function saveInterpretation(input: SaveInterpretationInput) {
  return prisma.interpretation.create({
    data: {
      readingId: input.readingId,
      userId: input.userId,
      mode: input.mode,
      mood: input.mood ?? null,
      question: input.question ?? null,
      content: input.content,
      cacheHash: input.cacheHash,
      modelVersion: input.modelVersion,
      tokensUsed: input.tokensUsed,
      wasCached: false,
    },
  })
}
