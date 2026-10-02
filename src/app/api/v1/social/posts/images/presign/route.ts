import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { enforceCsrf } from "@/lib/middleware/csrf"
import { enforceSocialLimit } from "@/lib/middleware/rate-limit"
import { generatePresignedUrl } from "@/lib/r2"
import { EXT_BY_TYPE, postImagesPresignSchema } from "@/lib/validators/social"

export const dynamic = "force-dynamic"

/**
 * Presign de imagens de post (T064/AC-23, S2-12, RF-SOC-003/RNF-SOC-003):
 * `POST /api/v1/social/posts/images/presign`.
 *
 * Ordem (padrão Phase 2): CSRF (T041) → Bearer → corpo JSON (422) →
 * `postImagesPresignSchema` (máx 4, contentType ∈ jpeg/png/webp; 422 com
 * `details`) → rate limit `upload`
 * (20/dia S2-10 via `enforceSocialLimit` → núcleo `checkUploadLimit` do
 * T027; 429 com `Retry-After`) → presign. Tamanho NÃO é checado aqui: o
 * `Content-Length` deste request é o do JSON (não da imagem) — o guard de
 * 5MB é do PUT autorizado pela assinatura (decisão S2-12; verificação
 * HEAD pós-PUT pendente de decisão do dono).
 *
 * Keys `posts/{userId}/{ts}-{i}.{ext}` — prefixo validado por T051 na
 * criação do post (S2-12). Resposta `{ uploads: [{ uploadUrl, key }] }`
 * (mesmo shape top-level do presign de avatar): o cliente faz PUT direto
 * ao R2 (expiração 300s — CHK014). Bytes NÃO são revalidados após o PUT
 * (decisão S2-12: sem re-baixar).
 */
export async function POST(request: Request): Promise<Response> {
  const reqId = newReqId()

  const csrfError = enforceCsrf(request, reqId)
  if (csrfError) return csrfError

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return apiError("VALIDATION_ERROR", "Corpo invalido", reqId, 422)
  }

  const parsed = postImagesPresignSchema.safeParse(rawBody)
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Dados invalidos",
      reqId,
      422,
      parsed.error.errors.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    )
  }
  const images = parsed.data.images

  const rate = await enforceSocialLimit({
    limit: "upload",
    userId: auth.userId,
    reqId,
  })
  if (!rate.allowed) return rate.response

  try {
    const timestamp = Date.now()
    const uploads = await Promise.all(
      images.map(async ({ contentType }, index) => {
        const key = `posts/${auth.userId}/${timestamp}-${index}.${EXT_BY_TYPE[contentType]}`
        const uploadUrl = await generatePresignedUrl(key, contentType)
        return { uploadUrl, key }
      }),
    )

    logger.info(
      { reqId, userId: auth.userId, count: uploads.length },
      "[posts:presign] URLs presignadas",
    )
    return Response.json({ uploads }, { status: 200, headers: rate.headers })
  } catch (error) {
    logger.error({ err: error, reqId }, "[posts:presign] erro ao presignar")
    return apiError(
      "INTERNAL_ERROR",
      "Erro interno",
      reqId,
      500,
      undefined,
      rate.headers,
    )
  }
}
