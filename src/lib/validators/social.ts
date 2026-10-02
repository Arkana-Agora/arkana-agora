import { z } from "zod"

/**
 * Schemas Zod das rotas sociais (T051/T064).
 * Limites por tipo de post (plano T051): texto ≤500, imagem ≤300,
 * tiragem ≤200; até 4 imagens por post (S2-12 — tipo/tamanho autoritativos
 * no presign T064, aqui só a forma do payload).
 */

export const MAX_CONTENT_BY_TYPE = {
  text: 500,
  image: 300,
  reading: 200,
} as const

export const MAX_POST_IMAGES = 4

// Ext canônico por MIME (image/jpeg → jpg) — single source do presign de
// imagens de post (T064): o cliente e as rotas usam este mapa.
export const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export const createPostSchema = z
  .object({
    type: z.enum(["text", "image", "reading"]),
    content: z.string().optional(),
    imageUrls: z.array(z.string().min(1)).optional(),
    readingId: z.string().min(1).optional(),
    audience: z.enum(["public", "followers"]).default("public"),
    commentsDisabled: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const maxContent = MAX_CONTENT_BY_TYPE[value.type]

    if (value.type === "text" && (value.content ?? "").trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Conteudo obrigatorio para posts de texto",
      })
    }
    if (
      value.content !== undefined &&
      value.content.trim().length === 0 &&
      value.type !== "text"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Conteudo vazio nao permitido",
      })
    }
    if (value.content !== undefined && value.content.length > maxContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: `Maximo ${maxContent} caracteres para posts do tipo ${value.type}`,
      })
    }

    if (value.type === "image") {
      if (!value.imageUrls || value.imageUrls.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["imageUrls"],
          message: "Envie de 1 a 4 imagens",
        })
      } else if (value.imageUrls.length > MAX_POST_IMAGES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["imageUrls"],
          message: `Maximo ${MAX_POST_IMAGES} imagens`,
        })
      }
    } else if (value.imageUrls && value.imageUrls.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageUrls"],
        message: "Somente posts de imagem aceitam imagens",
      })
    }

    if (value.type === "reading") {
      if (!value.readingId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["readingId"],
          message: "readingId obrigatorio para posts de tiragem",
        })
      }
    } else if (value.readingId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["readingId"],
        message: "readingId somente para posts de tiragem",
      })
    }
  })

export type CreatePostInput = z.infer<typeof createPostSchema>

/**
 * Presign de imagens de post (T064/S2-12): max 4, MIMEs aceitos pelo R2
 * (JPEG/PNG/WebP). O limite de 5MB é checado no cliente e, na rota, o
 * `Content-Length` do REQUEST de presign (mecanismo literal do plano — o
 * bytes do PUT não são revalidados; ver limitação conhecida em
 * `docs/04-api/social.md` e S2-12).
 */
export const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024

export const postImagesPresignSchema = z
  .object({
    images: z
      .array(
        z
          .object({
            contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_POST_IMAGES),
  })
  .strict()

export type PostImagesPresignInput = z.infer<typeof postImagesPresignSchema>
