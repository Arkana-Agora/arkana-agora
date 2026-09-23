const DEFAULT_INTERPRETATION_MODEL = "gpt-4o"
const DEFAULT_FOLLOW_UP_MODEL = "gpt-4o-mini"

export function getInterpretationModel(): string {
  const configured = process.env.AI_MODEL?.trim()
  return configured && configured.length > 0
    ? configured
    : DEFAULT_INTERPRETATION_MODEL
}

export function getFollowUpModel(): string {
  const configured = process.env.AI_MODEL_FOLLOWUP?.trim()
  return configured && configured.length > 0
    ? configured
    : DEFAULT_FOLLOW_UP_MODEL
}
