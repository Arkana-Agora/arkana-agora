import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { getInterpretationModel, getFollowUpModel } from "@/lib/ai/models"

describe("AI model selection", () => {
  const originalModel = process.env.AI_MODEL
  const originalFollowUp = process.env.AI_MODEL_FOLLOWUP

  beforeEach(() => {
    delete process.env.AI_MODEL
    delete process.env.AI_MODEL_FOLLOWUP
  })

  afterEach(() => {
    if (originalModel === undefined) delete process.env.AI_MODEL
    else process.env.AI_MODEL = originalModel
    if (originalFollowUp === undefined) delete process.env.AI_MODEL_FOLLOWUP
    else process.env.AI_MODEL_FOLLOWUP = originalFollowUp
  })

  it("defaults interpretation model to gpt-4o", () => {
    expect(getInterpretationModel()).toBe("gpt-4o")
  })

  it("defaults follow-up model to gpt-4o-mini", () => {
    expect(getFollowUpModel()).toBe("gpt-4o-mini")
  })

  it("respects AI_MODEL override", () => {
    process.env.AI_MODEL = "gpt-4o-mini"
    expect(getInterpretationModel()).toBe("gpt-4o-mini")
  })

  it("respects AI_MODEL_FOLLOWUP override", () => {
    process.env.AI_MODEL_FOLLOWUP = "gpt-4o"
    expect(getFollowUpModel()).toBe("gpt-4o")
  })

  it("ignores blank env values", () => {
    process.env.AI_MODEL = "   "
    process.env.AI_MODEL_FOLLOWUP = ""
    expect(getInterpretationModel()).toBe("gpt-4o")
    expect(getFollowUpModel()).toBe("gpt-4o-mini")
  })
})
