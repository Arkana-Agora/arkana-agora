import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

// Contrato do schema Sprint 2 (T001–T016): garante que models/campos/índices
// criados na Phase 0 não sejam removidos ou renomeados por regressão acidental.
const schema = readFileSync(resolve("prisma/schema.prisma"), "utf8")

const hasModel = (name: string) =>
  new RegExp(`^model ${name} \\{`, "m").test(schema)

describe("schema Sprint 2 — models (T001–T013)", () => {
  it.each([
    "Follow",
    "Post",
    "Comment",
    "PostLike",
    "PostHashtag",
    "Gift",
    "Notification",
    "HoroscopeContent",
    "HoroscopeEntry",
    "HoroscopeLog",
    "HoroscopeNotification",
    "ContentReport",
    "CommentLike",
    "FollowReward",
  ])("model %s existe", (name) => {
    expect(hasModel(name)).toBe(true)
  })
})

describe("schema Sprint 2 — constraints e índices (T015/T016)", () => {
  it.each([
    ["Follow", "@@unique([followerId, followingId])"],
    ["Follow", "@@index([followingId, createdAt, id])"],
    ["Follow", "@@index([followerId, createdAt, id])"],
    ["Post", "@@index([authorId, createdAt])"],
    ["Post", "@@index([createdAt])"],
    ["Comment", "@@index([postId, createdAt])"],
    ["Comment", "@@index([authorId])"],
    ["PostLike", "@@unique([postId, userId])"],
    ["PostLike", "@@index([userId])"],
    ["CommentLike", "@@unique([commentId, userId])"],
    ["PostHashtag", "@@index([tag])"],
    ["Notification", "@@index([userId, isRead, createdAt])"],
    ["ContentReport", "@@index([targetType, targetId])"],
    ["ContentReport", "@@index([reporterId])"],
    ["HoroscopeContent", "@@unique([type, signId, element, period, date])"],
    ["HoroscopeContent", "@@index([type, period, date])"],
    ["HoroscopeEntry", "@@index([userId, createdAt])"],
    ["HoroscopeLog", "@@index([userId, createdAt])"],
    ["FollowReward", "@@unique([followerId, followingId])"],
  ])("%s declara %s", (model, constraint) => {
    const block = schema.match(
      new RegExp(`^model ${model} \\{[\\s\\S]*?^\\}`, "m"),
    )
    expect(block, `model ${model} não encontrado`).toBeTruthy()
    expect(block![0]).toContain(constraint)
  })
})

describe("schema Sprint 2 — campos críticos", () => {
  it.each([
    ["Post", "imageUrls        String[] @default([])"],
    ["Post", 'audience         String   @default("public")'],
    ["Post", "likeCount        Int      @default(0)"],
    ["Post", "isPinned"],
    ["Comment", "parentCommentId String?"],
    ["Gift", "coinCost           Int"],
    ["Gift", "recipientEarnsHalf Boolean  @default(false)"],
    ["HoroscopeNotification", "userId          String  @unique"],
    ["ContentReport", "status"],
  ])("%s declara %s", (model, field) => {
    const block = schema.match(
      new RegExp(`^model ${model} \\{[\\s\\S]*?^\\}`, "m"),
    )
    expect(block, `model ${model} não encontrado`).toBeTruthy()
    expect(block![0]).toContain(field)
  })

  it.each([
    "subscriptionTier UserPlan     @default(FREE)",
    "isBanned         Boolean      @default(false)",
    "maxFollowing     Int          @default(5000)",
  ])("User declara %s (T014)", (field) => {
    expect(schema).toContain(field)
  })

  it.each([
    "versosBalance   Int      @default(0)",
    "versosStreak    Int      @default(0)",
    "lastClaimAt     DateTime?",
  ])("UserProfile declara %s (T014/S2-17)", (field) => {
    expect(schema).toContain(field)
  })
})
