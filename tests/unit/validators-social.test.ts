import { describe, it, expect } from "vitest"
import {
  createCommentSchema,
  updateCommentSchema,
  MAX_COMMENT_CONTENT,
} from "@/lib/validators/social"
import { REMOVED_COMMENT_CONTENT } from "@/lib/social/comments"

describe("comment schemas — reservado ao soft-delete", () => {
  it("createCommentSchema rejeita o sentinel [removido]", () => {
    const result = createCommentSchema.safeParse({
      content: REMOVED_COMMENT_CONTENT,
    })
    expect(result.success).toBe(false)
  })

  it("updateCommentSchema rejeita o sentinel [removido]", () => {
    const result = updateCommentSchema.safeParse({
      content: REMOVED_COMMENT_CONTENT,
    })
    expect(result.success).toBe(false)
  })

  it("createCommentSchema aceita conteudo comum", () => {
    const result = createCommentSchema.safeParse({ content: "Olá, tarot!" })
    expect(result.success).toBe(true)
  })

  it("createCommentSchema ainda rejeita vazio", () => {
    expect(createCommentSchema.safeParse({ content: "   " }).success).toBe(
      false,
    )
  })

  it("createCommentSchema ainda aplica o limite de caracteres", () => {
    const long = "a".repeat(MAX_COMMENT_CONTENT + 1)
    expect(createCommentSchema.safeParse({ content: long }).success).toBe(false)
  })
})
