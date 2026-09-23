import sharp from "sharp"
import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import {
  getObjectBuffer,
  putObjectBuffer,
  deleteObject,
  R2_PUBLIC_URL,
} from "@/lib/r2"

export const dynamic = "force-dynamic"

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"])
const SIZES = [48, 120, 400] as const

async function processAvatar(buffer: Buffer): Promise<
  {
    size: number
    data: Buffer
  }[]
> {
  const results = await Promise.all(
    SIZES.map(async (size) => ({
      size,
      data: await sharp(buffer)
        .rotate()
        .resize(size, size, { fit: "cover" })
        .webp({ quality: 85 })
        .toBuffer(),
    })),
  )
  return results
}

async function processWithRetry(buffer: Buffer) {
  try {
    return await processAvatar(buffer)
  } catch (firstError) {
    logger.warn(
      { err: firstError },
      "[avatar:confirm] processamento falhou, retry 1x",
    )
    return processAvatar(buffer)
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const reqId = newReqId()
  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  let body: { fileKey?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json(
      {
        error: { code: "VALIDATION_ERROR", message: "Corpo invalido" },
        meta: { requestId: reqId },
      },
      { status: 422 },
    )
  }

  if (!body.fileKey) {
    return Response.json(
      {
        error: { code: "VALIDATION_ERROR", message: "fileKey obrigatorio" },
        meta: { requestId: reqId },
      },
      { status: 422 },
    )
  }

  const expectedPrefix = `avatars/${auth.userId}/`
  if (!body.fileKey.startsWith(expectedPrefix) || body.fileKey.includes("..")) {
    logger.warn(
      { reqId, userId: auth.userId, fileKey: body.fileKey },
      "[avatar:confirm] fileKey invalido — possivel path traversal",
    )
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Chave de arquivo invalida",
        },
        meta: { requestId: reqId },
      },
      { status: 422 },
    )
  }

  try {
    const original = await getObjectBuffer(body.fileKey)

    if (original.length > MAX_BYTES) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Arquivo muito grande. Maximo 5MB.",
          },
          meta: { requestId: reqId },
        },
        { status: 422 },
      )
    }

    const mime = `image/${body.fileKey.split(".").pop()?.toLowerCase() ?? ""}`
    const normalizedMime = mime === "image/jpg" ? "image/jpeg" : mime
    if (!ALLOWED_MIME.has(normalizedMime)) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Formato nao suportado",
          },
          meta: { requestId: reqId },
        },
        { status: 422 },
      )
    }

    let variants: { size: number; data: Buffer }[]
    try {
      variants = await processWithRetry(original)
    } catch (processError) {
      logger.error(
        { err: processError, reqId, userId: auth.userId },
        "[avatar:confirm] processamento falhou apos retry — mantendo avatar anterior",
      )
      return Response.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Falha ao processar imagem. Avatar anterior mantido.",
          },
          meta: { requestId: reqId },
        },
        { status: 500 },
      )
    }

    const baseKey = body.fileKey.replace(/\.[^.]+$/, "")
    const stamp = Date.now()
    const uploads = await Promise.all(
      variants.map(({ size, data }) =>
        putObjectBuffer(`${baseKey}-${size}-${stamp}.webp`, data, "image/webp"),
      ),
    )
    void uploads

    const mainKey = `${baseKey}-400-${stamp}.webp`
    const avatarUrl = `${R2_PUBLIC_URL}/${mainKey}`

    await prisma.user.update({
      where: { id: auth.userId },
      data: { avatar: avatarUrl },
    })

    try {
      await deleteObject(body.fileKey)
    } catch (cleanupError) {
      logger.warn(
        { err: cleanupError, reqId },
        "[avatar:confirm] falha ao limpar original (nao critico)",
      )
    }

    logger.info(
      { reqId, userId: auth.userId, avatarUrl },
      "[avatar:confirm] avatar processado e atualizado",
    )
    return Response.json({
      avatarUrl,
      variants: variants.map(
        ({ size }) => `${R2_PUBLIC_URL}/${baseKey}-${size}-${stamp}.webp`,
      ),
    })
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[avatar:confirm] erro ao confirmar avatar",
    )
    return Response.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Erro interno" },
        meta: { requestId: reqId },
      },
      { status: 500 },
    )
  }
}
