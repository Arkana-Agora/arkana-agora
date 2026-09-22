"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import authApi from "@/lib/api"
import type { Deck, Spread } from "@/types/tarot"

const readingCardSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  positionIndex: z.number(),
  isReversed: z.boolean(),
})

const readingSchema = z.object({
  id: z.string(),
  deckId: z.string(),
  spreadId: z.string(),
  title: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  seed: z.string(),
  duration: z.number(),
  isPublic: z.boolean(),
  createdAt: z.string(),
  cards: z.array(readingCardSchema),
})

const readingListResponseSchema = z.object({
  readings: z.array(readingSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
})

const readingDetailResponseSchema = z.object({
  reading: z.object({
    id: z.string(),
    deckId: z.string(),
    spreadId: z.string(),
    title: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    seed: z.string(),
    duration: z.number(),
    isPublic: z.boolean(),
    createdAt: z.string(),
    cards: z.array(readingCardSchema),
  }),
})

const createReadingResponseSchema = z.object({
  reading: z.object({
    id: z.string(),
    cards: z.array(readingCardSchema),
    spread: z.record(z.unknown()),
    createdAt: z.string(),
  }),
})

const dailyCountResponseSchema = z.object({
  count: z.number(),
  totalLimit: z.number(),
  remaining: z.number(),
  tier: z.string(),
})

export type Reading = z.infer<typeof readingSchema>
export type ReadingListResponse = z.infer<typeof readingListResponseSchema>
export type DailyCountResponse = z.infer<typeof dailyCountResponseSchema>

interface ReadingsParams {
  page?: number
  limit?: number
  deckId?: string
}

export function useReadings(params?: ReadingsParams) {
  return useQuery({
    queryKey: ["readings", params?.page, params?.limit, params?.deckId],
    queryFn: async () => {
      const res = await authApi.get("/readings", { params: params ?? {} })
      return readingListResponseSchema.parse(res.data)
    },
  })
}

export function useReading(id: string) {
  return useQuery({
    queryKey: ["reading", id],
    queryFn: async () => {
      const res = await authApi.get(`/readings/${id}`)
      return readingDetailResponseSchema.parse(res.data)
    },
    enabled: !!id,
  })
}

export function useDailyCount() {
  return useQuery({
    queryKey: ["readings", "daily-count"],
    queryFn: async () => {
      const res = await authApi.get("/readings/daily-count")
      return dailyCountResponseSchema.parse(res.data)
    },
  })
}

export function useDecks() {
  return useQuery({
    queryKey: ["decks"],
    queryFn: async () => {
      const res = await authApi.get("/decks")
      return res.data as Deck[]
    },
  })
}

export function useSpreads(deckType?: string) {
  return useQuery({
    queryKey: ["spreads", deckType],
    queryFn: async () => {
      const params = deckType ? { deckType } : {}
      const res = await authApi.get("/spreads", { params })
      return res.data as Spread[]
    },
  })
}

interface CreateReadingInput {
  deckId: string
  spreadId: string
  title?: string
  notes?: string
  isPublic?: boolean
}

export function useCreateReading() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateReadingInput) => {
      const res = await authApi.post("/readings", data)
      return createReadingResponseSchema.parse(res.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["readings"] })
      queryClient.invalidateQueries({ queryKey: ["readings", "daily-count"] })
    },
  })
}
