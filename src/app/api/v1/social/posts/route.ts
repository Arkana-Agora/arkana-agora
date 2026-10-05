import type { Prisma } from "@prisma/client"

import { emitNewPost } from "@socket/src/emitters"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { trackPostCreate, trackPostLimitHit } from "@/lib/analytics"
import { apiError } from "@/lib/api-response"
import { refreshFeedCache } from "@/lib/feed-cache"
import { logger, newReqId } from "@/lib/logger"
import { enforceCsrf } from "@/lib/middleware/csrf"
import { enforceSocialLimit } from "@/lib/middleware/rate-limit"
import { checkContent } from "@/lib/moderation"
import { prisma } from "@/lib/prisma"
import { headObjectSize } from "@/lib/r2"
import { parseHashtags } from "@/lib/social/mentions"
import { getSocialLimitValue } from "@/lib/social/limits"
import { postPreview } from "@/lib/social/post-preview"
import { earnVersos, VersosSource } from "@/lib/social/versos"
import { createPostSchema } from "@/lib/validators/social"

export const dynamic = "force-dynamic"

// Mesmo limite de upload do avatar/confirm: 5MB por imagem (S2-12).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const AUTHOR_SELECT = {
  id: true,
  name: true,
  displayName: true,
  avatar: true,
} satisfies Prisma.UserSelect

/**
 * Criação de post (T051/AC-5, US-021): texto (≤500), imagem (≤300 + até 4
 * imagens com chave `posts/{userId}/` — S2-12) ou tiragem (≤200).
 *
 * Ordem do handler (padrão Phase 1): CSRF → auth → corpo (422) → tier do
 * viewer → rate limit `post` (T027/S2-10: 10/dia FREE, 50/dia PLUS, com
 * `Retry-After` no 429) → checagens de negócio → 1 `$transaction`.
 *
 * - S2-12: após validar a chave, `HeadObject` por imagem rejeita objeto
 *   acima de 5MB (`MAX_IMAGE_BYTES`) sem re-baixar — null segue o caminho
 *   normal (padrão de `avatar/confirm`).
 * - Moderação (CHK011, decisão do dono 2026-09-30): `checkContent` flaggou →
 *   **bloqueia** com 403 `CONTENT_BLOCKED` + `details.flaggedWords`.
 * - Tiragem alheia/inexistente → 403 `READING_ACCESS_DENIED` (uniforme,
 *   anti-oráculo).
 * - S2-19: criação **não** escreve `likeCount`/`commentCount` (defaults 0);
 *   incrementos pertencem a T076/T077/T081.
 * - Hashtags (`parseHashtags`, dedupe case-insensitive) viram linhas em
 *   `PostHashtag` na mesma transação do post.
 * - `type=reading` paga +10 Versos (T037) dentro da tx; `earnVersos` null
 *   (sem `UserProfile`) aborta a transação (padrão K2 da Phase 1).
 * - Emit `new-post` para as rooms dos seguidores (T070/T088 parcial,
 *   puxado para a Phase 2.5) após o commit — fire-and-forget.
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

  const parsed = createPostSchema.safeParse(rawBody)
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
  const input = parsed.data

  // Tier do proprio viewer (não é oráculo de recurso alheio) — necessário
  // para o limite diario por tier (10 FREE / 50 PLUS) do enforceSocialLimit.
  const viewer = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { subscriptionTier: true },
  })
  if (!viewer) {
    return apiError("AUTH_TOKEN_INVALID", "Sessao invalida", reqId, 401)
  }

  const rate = await enforceSocialLimit({
    limit: "post",
    userId: auth.userId,
    tier: viewer.subscriptionTier,
    reqId,
  })
  if (!rate.allowed) {
    trackPostLimitHit(
      viewer.subscriptionTier,
      getSocialLimitValue("post", viewer.subscriptionTier),
    )
    return rate.response
  }

  const imageUrls = input.imageUrls ?? []
  // Chave tem que ser exatamente o formato emitido pelo presign T064 para o
  // dono: `posts/{userId}/{ts}-{i}.{ext}` — cobre prefixo de outro usuário,
  // traversal (`..`) e extensões fora do permitido (review Phase 2).
  const keyPattern = new RegExp(
    `^posts/${auth.userId}/\\d+-[0-3]\\.(?:jpg|png|webp)$`,
  )
  for (const key of imageUrls) {
    if (!keyPattern.test(key)) {
      return apiError(
        "VALIDATION_ERROR",
        "Chave de imagem invalida",
        reqId,
        422,
        { field: "imageUrls", message: "Chave de imagem invalida" },
        rate.headers,
      )
    }
  }

  // S2-12: o guard de 5MB é do objeto APÓS o PUT — HeadObject por chave
  // rejeita imagem grande sem re-baixar (null = objeto ausente segue o
  // caminho normal; mesmo padrão de avatar/confirm).
  for (const key of imageUrls) {
    const size = await headObjectSize(key)
    if (size !== null && size > MAX_IMAGE_BYTES) {
      return apiError(
        "VALIDATION_ERROR",
        "Imagem muito grande. Maximo 5MB.",
        reqId,
        422,
        { field: "imageUrls", message: "Imagem muito grande. Maximo 5MB." },
        rate.headers,
      )
    }
  }

  // Moderação (T025/T051): conteúdo flaggado bloqueia a criação (CHK011)
  if (input.content) {
    const moderation = checkContent(input.content)
    if (!moderation.allowed) {
      logger.warn(
        { reqId, userId: auth.userId, flaggedWords: moderation.flaggedWords },
        "[posts] conteudo bloqueado pela moderacao",
      )
      return apiError(
        "CONTENT_BLOCKED",
        "Conteudo nao permitido",
        reqId,
        403,
        { flaggedWords: moderation.flaggedWords },
        rate.headers,
      )
    }
  }

  if (input.type === "reading" && input.readingId) {
    const reading = await prisma.reading.findUnique({
      where: { id: input.readingId },
      select: { userId: true },
    })
    if (!reading || reading.userId !== auth.userId) {
      return apiError(
        "READING_ACCESS_DENIED",
        "Tiragem nao disponivel",
        reqId,
        403,
        undefined,
        rate.headers,
      )
    }
  }

  try {
    const post = await prisma.$transaction(async (tx) => {
      // Paga ANTES de criar (abort-early): earnVersos null = sem
      // UserProfile → lança e a tx nem chega a criar o post (K2).
      if (input.type === "reading") {
        const earned = await earnVersos(auth.userId, VersosSource.Reading, tx)
        if (earned === null) {
          logger.error(
            { reqId, userId: auth.userId },
            "[posts] earnVersos sem UserProfile — abortando tx",
          )
          throw new Error("reading post requires UserProfile")
        }
      }

      const created = await tx.post.create({
        data: {
          authorId: auth.userId,
          type: input.type,
          content: input.content ?? "",
          imageUrls,
          ...(input.readingId ? { readingId: input.readingId } : {}),
          audience: input.audience,
          commentsDisabled: input.commentsDisabled ?? false,
        },
        include: { author: { select: AUTHOR_SELECT } },
      })

      const tags = parseHashtags(input.content ?? "")
      if (tags.length > 0) {
        await tx.postHashtag.createMany({
          data: tags.map((tag) => ({ postId: created.id, tag })),
        })
      }

      return created
    })

    logger.info(
      { reqId, userId: auth.userId, postId: post.id, type: post.type },
      "[posts] post criado",
    )
    // Analytics (T136 no-op server-side até deploy — mesmo padrão do follow)
    trackPostCreate(input.type, imageUrls.length > 0)

    // Reconstrói a página materializada do autor para o post novo aparecer
    // sem esperar o TTL do cache (review). `refreshFeedCache` engole erros
    // internamente (Redis fora nunca falha o 201).
    void refreshFeedCache(auth.userId)

    // Realtime (T070/T088 parcial): rooms `user:{id}`/`feed:{id}` dos
    // seguidores. emitNewPost engole erros internos (fire-and-forget).
    void emitNewPost({
      authorId: auth.userId,
      postId: post.id,
      preview: postPreview(post.content),
    })

    return Response.json(
      { data: { post } },
      { status: 201, headers: rate.headers },
    )
  } catch (error) {
    logger.error({ err: error, reqId }, "[posts] erro ao criar post")
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
