import { z } from "zod"
import { DECK_IDS } from "@/lib/tarot/decks"
import spreadsData from "@/data/spreads.json"

const SPREAD_IDS = spreadsData.map((s) => s.id)

export const createReadingSchema = z.object({
  deckId: z
    .string()
    .refine((val) => (DECK_IDS as readonly string[]).includes(val), {
      message: "deckId invalido. Valores validos: rws, thoth, lenormand",
    }),
  spreadId: z.string().refine((val) => SPREAD_IDS.includes(val), {
    message: "spreadId invalido",
  }),
  title: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  isPublic: z.boolean().optional(),
})

export type CreateReadingInput = z.infer<typeof createReadingSchema>
