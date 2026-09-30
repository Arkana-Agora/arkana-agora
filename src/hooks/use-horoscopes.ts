"use client"

import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { z } from "zod"

import authApi from "@/lib/api"
import {
  HOROSCOPE_TYPES,
  PROMPT_PERIODS,
  type HoroscopeType,
  type PromptPeriod,
} from "@/lib/horoscopes/prompts"
import {
  horoscopeContentShape,
  type HoroscopePeriod,
} from "@/lib/horoscopes/validation"

export type { HoroscopePeriod, HoroscopeType, PromptPeriod }

export const horoscopeTypeSchema = z.enum(HOROSCOPE_TYPES)
export const horoscopePeriodSchema = z.enum(PROMPT_PERIODS)

const horoscopeSchema = z.object({
  type: horoscopeTypeSchema,
  signId: z.string(),
  element: z.string().nullable().optional(),
  period: horoscopePeriodSchema,
  date: z.string(),
  content: horoscopeContentShape,
  source: z.enum(["generated", "fallback"]).optional(),
})

export type Horoscope = z.infer<typeof horoscopeSchema>

const horoscopePayloadSchema = z.union([
  z.object({ horoscope: horoscopeSchema }),
  horoscopeSchema,
])

function parseHoroscope(payload: unknown): Horoscope {
  const parsed = horoscopePayloadSchema.parse(payload)
  return "horoscope" in parsed ? parsed.horoscope : parsed
}

const myHoroscopeSchema = z.object({
  western: horoscopeSchema.nullable(),
  chinese: horoscopeSchema.nullable(),
  mayan: horoscopeSchema.nullable(),
})

export type MyHoroscope = z.infer<typeof myHoroscopeSchema>

const horoscopeHistoryPageSchema = z.object({
  entries: z.array(
    z.object({
      id: z.string(),
      type: horoscopeTypeSchema,
      signId: z.string(),
      period: horoscopePeriodSchema,
      createdAt: z.string(),
    }),
  ),
  nextCursor: z.string().nullable().optional(),
})

export type HoroscopeHistoryPage = z.infer<typeof horoscopeHistoryPageSchema>

/**
 * Horóscopo por tipo/período/data (T038/US-024) — consumidores:
 * rotas T093 (western), T106 (chinese), T113 (maya). Aceita o payload
 * direto ou o envelope `{ horoscope }` (zod union).
 */
export function useHoroscopes(
  type: HoroscopeType,
  period: HoroscopePeriod,
  date?: string,
) {
  return useQuery({
    queryKey: ["horoscopes", type, period, date ?? null],
    queryFn: async () => {
      const res = await authApi.get(`/horoscopes/${type}`, {
        params: date ? { period, date } : { period },
      })
      return parseHoroscope(res.data)
    },
  })
}

/**
 * Horóscopo do usuário logado agregando os 3 sistemas (T094/Q8):
 * `GET /horoscopes/my-horoscope` → `{ western, chinese, mayan }`
 * (ausência por sistema = `null` explícito — CHK018).
 */
export function useMyHoroscope() {
  return useQuery({
    queryKey: ["horoscopes", "me"],
    queryFn: async () => {
      const res = await authApi.get("/horoscopes/my-horoscope")
      return myHoroscopeSchema.parse(res.data)
    },
  })
}

/** Histórico de leituras do usuário com paginação por cursor (T095). */
export function useHoroscopeHistory(cursor?: string | null) {
  return useInfiniteQuery({
    queryKey: ["horoscopes", "history", cursor ?? null],
    queryFn: async ({ pageParam }) => {
      const res = await authApi.get("/horoscopes/history", {
        params: pageParam ? { cursor: pageParam } : {},
      })
      return horoscopeHistoryPageSchema.parse(res.data)
    },
    initialPageParam: cursor ?? null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}
