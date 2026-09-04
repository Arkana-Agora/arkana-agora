import { z } from "zod"

export const passwordSchema = z
  .string()
  .min(8, "Pelo menos 8 caracteres")
  .regex(/[A-Z]/, "Pelo menos 1 letra maiuscula")
  .regex(/[a-z]/, "Pelo menos 1 letra minuscula")
  .regex(/[0-9]/, "Pelo menos 1 numero")
  .regex(/[^A-Za-z0-9]/, "Pelo menos 1 caractere especial")

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Minimo 2 caracteres")
      .max(50, "Maximo 50 caracteres"),
    email: z.string().trim().email("Formato de e-mail invalido"),
    password: passwordSchema,
    passwordConfirmation: z.string(),
    acceptTerms: z
      .boolean()
      .refine((v) => v === true, "Voce deve aceitar os termos"),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Confirmacao de senha nao confere",
    path: ["passwordConfirmation"],
  })

export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().trim().email("Formato de e-mail invalido"),
  password: z.string().min(1, "Senha obrigatoria"),
})

export type LoginInput = z.infer<typeof loginSchema>

export const logoutSchema = z.object({
  allDevices: z.boolean().optional(),
})

export type LogoutInput = z.infer<typeof logoutSchema>

export const magicLinkSchema = z
  .object({
    email: z.string().trim().email("Formato de e-mail invalido"),
  })
  .strict()

export type MagicLinkInput = z.infer<typeof magicLinkSchema>
