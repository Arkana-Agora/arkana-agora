import { prisma } from "@/lib/prisma"
import { computeCacheHash } from "@/lib/ai/cache"
import {
  findCachedInterpretation,
  saveInterpretation,
} from "@/lib/ai/cache-service"
import { getSystemPrompt } from "@/lib/ai/prompts/system"
import { buildUserPrompt } from "@/lib/ai/prompts/user"

export const MODEL_VERSION = "gpt-4o-2024-08-06"

export const AI_DAILY_LIMITS: Record<string, number> = {
  FREE: 10,
  PLUS: Number.MAX_SAFE_INTEGER,
}

export const FOLLOW_UP_LIMITS: Record<string, number> = {
  FREE: 10,
  PLUS: 30,
}

const MAX_FOLLOW_UP_HISTORY = 20

interface InterpretationContext {
  user: {
    id: string
    plan: string
    birthDate: Date | null
    astrologicalSign: string | null
    personalArcana: number | null
    name: string
  }
  reading: {
    id: string
    deckId: string
    spreadId: string
    cards: Array<{
      cardId: string
      positionIndex: number
      isReversed: boolean
    }>
  }
  tier: string
}

export async function getInterpretationContext(
  userId: string,
  readingId: string,
): Promise<InterpretationContext | { error: string; status: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      birthDate: true,
      astrologicalSign: true,
      personalArcana: true,
      name: true,
    },
  })

  if (!user) {
    return { error: "USER_NOT_FOUND", status: 404 }
  }

  const reading = await prisma.reading.findUnique({
    where: { id: readingId },
    include: {
      cards: { orderBy: { positionIndex: "asc" as const } },
    },
  })

  if (!reading || reading.userId !== userId) {
    return { error: "READING_NOT_FOUND", status: 404 }
  }

  const tier = (user.plan ?? "FREE").toUpperCase()

  return {
    user: { id: userId, ...user },
    reading: {
      id: reading.id,
      deckId: reading.deckId,
      spreadId: reading.spreadId,
      cards: reading.cards,
    },
    tier,
  }
}

function todayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function checkAndIncrementDailyUsage(
  userId: string,
  tier: string,
): Promise<{
  allowed: boolean
  remaining: number
  totalLimit: number
  tier: string
}> {
  const normalizedTier = tier.toUpperCase()
  const limit =
    normalizedTier in AI_DAILY_LIMITS ? AI_DAILY_LIMITS[normalizedTier]! : 10
  const date = todayStart()

  const usage = await prisma.aIDailyUsage.findUnique({
    where: { userId_date: { userId, date } },
  })

  const currentCount = usage?.interpretationCount ?? 0

  if (currentCount >= limit) {
    return {
      allowed: false,
      remaining: 0,
      totalLimit: limit,
      tier: normalizedTier,
    }
  }

  await prisma.aIDailyUsage.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, interpretationCount: 1, followUpCount: 0 },
    update: { interpretationCount: { increment: 1 } },
  })

  const remaining =
    limit === Number.MAX_SAFE_INTEGER
      ? Number.MAX_SAFE_INTEGER
      : limit - currentCount - 1

  return {
    allowed: true,
    remaining,
    totalLimit: limit,
    tier: normalizedTier,
  }
}

export async function checkAndIncrementFollowUpUsage(
  userId: string,
  tier: string,
): Promise<{
  allowed: boolean
  remaining: number
  followUpLimit: number
  tier: string
}> {
  const normalizedTier = tier.toUpperCase()
  const limit =
    normalizedTier in FOLLOW_UP_LIMITS ? FOLLOW_UP_LIMITS[normalizedTier]! : 10
  const date = todayStart()

  const usage = await prisma.aIDailyUsage.findUnique({
    where: { userId_date: { userId, date } },
  })

  const currentCount = usage?.followUpCount ?? 0

  if (currentCount >= limit) {
    return {
      allowed: false,
      remaining: 0,
      followUpLimit: limit,
      tier: normalizedTier,
    }
  }

  await prisma.aIDailyUsage.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, interpretationCount: 0, followUpCount: 1 },
    update: { followUpCount: { increment: 1 } },
  })

  const remaining =
    limit === Number.MAX_SAFE_INTEGER
      ? Number.MAX_SAFE_INTEGER
      : limit - currentCount - 1

  return {
    allowed: true,
    remaining,
    followUpLimit: limit,
    tier: normalizedTier,
  }
}

export async function getUsageStats(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [user, usage] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    }),
    prisma.aIDailyUsage.findUnique({
      where: { userId_date: { userId, date: today } },
    }),
  ])

  const tier = (user?.plan ?? "FREE").toUpperCase()
  const dailyLimit = AI_DAILY_LIMITS[tier] ?? 10
  const followUpLimit = FOLLOW_UP_LIMITS[tier] ?? 10

  const resetsAt = new Date()
  resetsAt.setHours(24, 0, 0, 0)

  return {
    interpretations: usage?.interpretationCount ?? 0,
    followUps: usage?.followUpCount ?? 0,
    dailyLimit,
    followUpLimit,
    tier,
    resetsAt: resetsAt.toISOString(),
  }
}

interface InterpretationPromptResult {
  systemPrompt: string
  userPrompt: string
  cacheHash: string
}

export function buildInterpretationPrompt(
  ctx: InterpretationContext,
  mode: string,
  mood?: string,
  question?: string,
): InterpretationPromptResult {
  const hashParams: Parameters<typeof computeCacheHash>[0] = {
    deckId: ctx.reading.deckId,
    spreadId: ctx.reading.spreadId,
    cards: ctx.reading.cards.map((c) => ({
      cardId: c.cardId,
      positionIndex: c.positionIndex,
      isReversed: c.isReversed,
    })),
    mode: mode as Parameters<typeof computeCacheHash>[0]["mode"],
    modelVersion: MODEL_VERSION,
  }
  if (mood) hashParams.mood = mood
  if (question) hashParams.question = question
  const cacheHash = computeCacheHash(hashParams)

  const systemPrompt = getSystemPrompt(
    mode as "general" | "love" | "career" | "yesno",
  )
  const promptParams: Parameters<typeof buildUserPrompt>[0] = {
    userName: ctx.user.name,
    deckName: ctx.reading.deckId.toUpperCase(),
    spreadName: ctx.reading.spreadId,
    cards: ctx.reading.cards.map((c) => ({
      position: `Posicao ${c.positionIndex + 1}`,
      cardName: c.cardId,
      cardNumber: c.positionIndex,
      isReversed: c.isReversed,
      meaning: "",
    })),
    mode: mode as Parameters<typeof buildUserPrompt>[0]["mode"],
  }
  if (mood) promptParams.mood = mood
  if (question) promptParams.question = question
  if (ctx.user.astrologicalSign)
    promptParams.zodiacSign = ctx.user.astrologicalSign
  if (ctx.user.personalArcana)
    promptParams.personalArcana = `Arcano ${ctx.user.personalArcana}`
  const userPrompt = buildUserPrompt(promptParams)

  return { systemPrompt, userPrompt, cacheHash }
}

interface FollowUpContext {
  interpretation: {
    id: string
    readingId: string
    userId: string
    mode: string
    content: string
  }
  user: { name: string; plan: string }
  reading: { deckId: string; spreadId: string } | null
  history: Array<{ role: string; content: string }>
  tier: string
}

export async function getFollowUpContext(
  interpretationId: string,
  userId: string,
): Promise<FollowUpContext | { error: string; status: number }> {
  const interpretation = await prisma.interpretation.findUnique({
    where: { id: interpretationId },
    select: {
      id: true,
      readingId: true,
      userId: true,
      mode: true,
      content: true,
    },
  })

  if (!interpretation || interpretation.userId !== userId) {
    return { error: "INTERPRETATION_NOT_FOUND", status: 404 }
  }

  const [user, reading, rawHistory] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, name: true },
    }),
    prisma.reading.findUnique({
      where: { id: interpretation.readingId },
      select: { deckId: true, spreadId: true },
    }),
    prisma.followUpMessage.findMany({
      where: { interpretationId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
      take: MAX_FOLLOW_UP_HISTORY,
    }),
  ])

  const tier = (user?.plan ?? "FREE").toUpperCase()

  return {
    interpretation,
    user: { name: user?.name ?? "Usuario", plan: user?.plan ?? "FREE" },
    reading,
    history: rawHistory,
    tier,
  }
}

export async function saveAssistantFollowUpMessage(
  interpretationId: string,
  content: string,
): Promise<void> {
  await prisma.followUpMessage.create({
    data: {
      interpretationId,
      role: "assistant",
      content,
    },
  })
}

export async function lookupCachedInterpretation(
  cacheHash: string,
  userId: string,
) {
  return findCachedInterpretation(cacheHash, userId)
}

export async function persistInterpretation(input: {
  readingId: string
  userId: string
  mode: string
  mood?: string | null
  question?: string | null
  content: string
  cacheHash: string
  tokensUsed: number
}) {
  return saveInterpretation({
    ...input,
    modelVersion: MODEL_VERSION,
  })
}
