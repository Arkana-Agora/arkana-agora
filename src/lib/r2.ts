import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

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

export const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL ?? `https://r2.arkanaagora.com`

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
