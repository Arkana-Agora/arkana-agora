"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { z } from "zod"

import authApi from "@/lib/api"
import {
  HOROSCOPE_TYPES,
  PROMPT_PERIODS,
  type HoroscopeType,
  type PromptPeriod,
} from "@/lib/horoscopes/prompts"
import {
  horoscopeNotificationPatchSchema,
  horoscopeNotificationSettingsSchema,
  type HoroscopeNotificationPatch,
} from "@/lib/horoscopes/notification-settings"
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
  kin: z
    .object({
      number: z.number().int().min(1).max(260),
      seal: z.number().int().min(0).max(19),
      tone: z.number().int().min(1).max(13),
    })
    .optional(),
})

export type Horoscope = z.infer<typeof horoscopeSchema>

// Matriz T090 (SC7): acionada por `targetSign` — eixos 0–100 inteiros.
const compatibilitySchema = z.object({
  targetSignId: z.string(),
  love: z.number(),
  friendship: z.number(),
  work: z.number(),
  overall: z.number(),
})

export type HoroscopeCompatibility = z.infer<typeof compatibilitySchema>

const horoscopeEnvelopeSchema = z.object({
  horoscope: horoscopeSchema,
  compatibility: compatibilitySchema.optional(),
})

const horoscopePayloadSchema = z.union([
  horoscopeEnvelopeSchema,
  horoscopeSchema,
])

export type HoroscopeWithCompatibility = Horoscope & {
  compatibility?: HoroscopeCompatibility | undefined
}

function parseHoroscope(payload: unknown): HoroscopeWithCompatibility {
  const parsed = horoscopePayloadSchema.parse(payload)
  if ("horoscope" in parsed)
    return { ...parsed.horoscope, compatibility: parsed.compatibility }
  return parsed
}

const myHoroscopeSchema = z.object({
  western: horoscopeSchema.nullable(),
  chinese: horoscopeSchema.nullable(),
  mayan: horoscopeSchema.nullable(),
})

export type MyHoroscope = z.infer<typeof myHoroscopeSchema>

// Envelope S2-18 `{ data: { entries }, pagination: { nextCursor } }` — o
// shape flat `{ entries, nextCursor }` (T038 original) foi aposentado em
// T095 junto com a rota de histórico.
const horoscopeHistoryPageSchema = z.object({
  data: z.object({
    entries: z.array(
      z.object({
        id: z.string(),
        type: horoscopeTypeSchema,
        signId: z.string(),
        element: z.string().nullable().optional(),
        period: horoscopePeriodSchema,
        createdAt: z.string(),
      }),
    ),
  }),
  pagination: z.object({ nextCursor: z.string().nullable() }),
})

export type HoroscopeHistoryPage = z.infer<typeof horoscopeHistoryPageSchema>

export interface HoroscopeQueryOptions {
  /** Signo explícito (prioriza a derivacao do perfil) — seletor T092. */
  sign?: string | undefined
  /** Aciona a matriz de compatibilidade T090 na resposta. */
  targetSign?: string | undefined
  /** Desliga a query (ex.: aguardando my-horoscope antes do fallback). */
  enabled?: boolean | undefined
}

/**
 * Horóscopo por tipo/período/data (T038/US-024) — consumidores:
 * rotas T093 (western), T106 (chinese), T113 (maya). Aceita o payload
 * direto ou o envelope `{ horoscope, compatibility? }` (zod union).
 * `options.sign`/`options.targetSign` (T092) viram query params.
 */
export function useHoroscopes(
  type: HoroscopeType,
  period: HoroscopePeriod,
  date?: string,
  options?: HoroscopeQueryOptions,
) {
  const sign = options?.sign
  const targetSign = options?.targetSign
  const enabled = options?.enabled ?? true
  return useQuery({
    enabled,
    queryKey: [
      "horoscopes",
      type,
      period,
      date ?? null,
      sign ?? null,
      targetSign ?? null,
    ],
    queryFn: async () => {
      const params: Record<string, string> = { period }
      if (date !== undefined) params.date = date
      if (sign !== undefined) params.sign = sign
      if (targetSign !== undefined) params.targetSign = targetSign
      const res = await authApi.get(`/horoscopes/${type}`, { params })
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

export interface HoroscopeHistoryFilters {
  type?: HoroscopeType | undefined
  period?: PromptPeriod | undefined
}

/** Histórico de leituras do usuário com paginação por cursor (T095) e
 * filtros `type`/`period` da rota (T096). O cursor vive só no
 * `pageParam` do infinite query — parâmetro separado criava caches
 * paralelos por cursor inicial (review julik). */
export function useHoroscopeHistory(filters?: HoroscopeHistoryFilters) {
  const type = filters?.type
  const period = filters?.period
  return useInfiniteQuery({
    queryKey: ["horoscopes", "history", type ?? null, period ?? null],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = {}
      if (pageParam) params.cursor = pageParam
      if (type !== undefined) params.type = type
      if (period !== undefined) params.period = period
      const res = await authApi.get("/horoscopes/history", { params })
      return horoscopeHistoryPageSchema.parse(res.data)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor ?? undefined,
  })
}

// Settings de notificação (T103/RF-HORO-008) — contrato GET/PATCH de
// `/horoscopes/notifications/settings`, single-source em
// `src/lib/horoscopes/notification-settings.ts` (compartilhado com a rota;
// re-export mantém o import antigo dos componentes funcionando).
export {
  horoscopeNotificationSettingsSchema,
  type HoroscopeNotificationSettings,
  type HoroscopeNotificationPatch,
} from "@/lib/horoscopes/notification-settings"

/** Settings atuais de notificação de horóscopo (T103). */
export function useHoroscopeNotificationSettings() {
  return useQuery({
    queryKey: ["horoscopes", "notifications", "settings"],
    queryFn: async () => {
      const res = await authApi.get("/horoscopes/notifications/settings")
      return horoscopeNotificationSettingsSchema.parse(res.data.data.settings)
    },
  })
}

/** Salva settings de notificação (upsert parcial) e invalida a leitura. */
export function useSaveHoroscopeNotificationSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: HoroscopeNotificationPatch) => {
      const payload = horoscopeNotificationPatchSchema.parse(patch)
      const res = await authApi.patch(
        "/horoscopes/notifications/settings",
        payload,
      )
      return horoscopeNotificationSettingsSchema.parse(res.data.data.settings)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["horoscopes", "notifications", "settings"],
      })
    },
  })
}
