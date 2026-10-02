import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { getR2PublicUrl } from "@/lib/r2-public-url"

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucketName = process.env.R2_BUCKET_NAME

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      "R2 credentials not configured: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME",
    )
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName }
}

let _client: S3Client | null = null

function getR2Client(): S3Client {
  if (!_client) {
    const config = getR2Config()
    _client = new S3Client({
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      region: "auto",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
  }
  return _client
}

export function getR2Bucket(): string {
  return getR2Config().bucketName
}

export const NEXT_PUBLIC_R2_PUBLIC_URL = getR2PublicUrl()

export async function generatePresignedUrl(
  key: string,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(getR2Client(), command, { expiresIn: 300 })
}

export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
  })
  await getR2Client().send(command)
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
  })
  const response = await getR2Client().send(command)
  if (!response.Body) {
    throw new Error(`R2 object has no body: ${key}`)
  }
  const bytes = await response.Body.transformToByteArray()
  return Buffer.from(bytes)
}

/**
 * Tamanho do objeto sem baixá-lo (review C3): `HeadObject` antes de
 * `GetObject` evita bufferar uploads gigantes em memória. Retorna `null`
 * quando o objeto não existe ou o header não vem — o chamador cai no
 * caminho de download (que valida o tamanho de novo por segurança).
 */
export async function headObjectSize(key: string): Promise<number | null> {
  try {
    const response = await getR2Client().send(
      new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key }),
    )
    return typeof response.ContentLength === "number"
      ? response.ContentLength
      : null
  } catch {
    return null
  }
}

export async function putObjectBuffer(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
  })
  await getR2Client().send(command)
}
