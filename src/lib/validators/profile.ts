import { z } from "zod"

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Minimo 3 caracteres")
  .max(30, "Maximo 30 caracteres")
  .regex(/^[a-zA-Z0-9_]+$/, "Apenas letras, numeros e underscore")

function isRealCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

const birthDateFieldSchema = z
  .union([
    z.literal(""),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD"),
  ])
  .refine((value) => value === "" || isRealCalendarDate(value), {
    message: "Data de nascimento invalida",
  })

export const updateProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Minimo 2 caracteres")
      .max(50, "Maximo 50 caracteres")
      .optional(),
    bio: z.string().trim().max(500, "Maximo 500 caracteres").optional(),
    birthDate: birthDateFieldSchema.optional(),
    birthPlace: z.string().trim().max(200, "Maximo 200 caracteres").optional(),
    location: z.string().trim().max(100, "Maximo 100 caracteres").optional(),
    website: z
      .union([z.literal(""), z.string().trim().url("URL invalida").max(200)])
      .optional(),
    username: z.union([z.literal(""), usernameSchema]).optional(),
  })
  .strict()

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const privacySchema = z
  .object({
    profileVisibility: z.enum(["public", "private"]).optional(),
    statsVisibility: z.enum(["public", "private"]).optional(),
    arcanaVisibility: z.enum(["public", "private"]).optional(),
    whoCanFollow: z.enum(["all", "following", "nobody"]).optional(),
    whoCanComment: z.enum(["all", "following", "nobody"]).optional(),
  })
  .strict()

export type PrivacyInput = z.infer<typeof privacySchema>

export interface PrivacySettings {
  profileVisibility?: "public" | "private"
  statsVisibility?: "public" | "private"
  arcanaVisibility?: "public" | "private"
  whoCanFollow?: "all" | "following" | "nobody"
  whoCanComment?: "all" | "following" | "nobody"
}

export const avatarPresignSchema = z
  .object({
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  })
  .strict()

export type AvatarPresignInput = z.infer<typeof avatarPresignSchema>
