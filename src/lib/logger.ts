import { randomUUID } from "node:crypto"
import pino from "pino"

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.body.password",
  "password",
  "token",
  "accessToken",
  "refreshToken",
]

const loggerOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || "info",
  base: { service: "arkana-agora" },
  redact: {
    paths: REDACT_PATHS,
    censor: "[redacted]",
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
}

if (process.env.NODE_ENV === "development") {
  loggerOptions.transport = {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  }
}

export const logger = pino(loggerOptions)

export function newReqId(): string {
  return randomUUID()
}
