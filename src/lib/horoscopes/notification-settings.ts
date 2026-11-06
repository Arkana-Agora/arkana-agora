import { z } from "zod"

/**
 * Settings de notificação de horóscopo (T103/RF-HORO-008) — contrato
 * único do GET/PATCH `/horoscopes/notifications/settings`, compartilhado
 * pela rota (server) e pelo hook `use-horoscopes` (client): os dois lados
 * validam com o MESMO zod, sem schema duplicado para divergir.
 */
export const horoscopeNotificationSettingsSchema = z.object({
  westernEnabled: z.boolean(),
  chineseEnabled: z.boolean(),
  mayaEnabled: z.boolean(),
  hour: z.number().int().min(0).max(23),
})

export type HoroscopeNotificationSettings = z.infer<
  typeof horoscopeNotificationSettingsSchema
>

export const horoscopeNotificationPatchSchema =
  horoscopeNotificationSettingsSchema
    .partial()
    .refine(
      (value) => Object.values(value).some((field) => field !== undefined),
      { message: "Ao menos um campo deve ser informado" },
    )

// z.infer do schema partial (não Partial<...>) — zod emite `T | undefined`
// para campos opcionais, compatível com exactOptionalPropertyTypes.
export type HoroscopeNotificationPatch = z.infer<
  typeof horoscopeNotificationPatchSchema
>
