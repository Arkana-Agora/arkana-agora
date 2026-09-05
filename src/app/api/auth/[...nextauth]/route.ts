import { handlers } from "@/auth/auth"
import { finalizeAuthResponse } from "@/auth/auth-callback"

const nextGet = handlers.GET
const nextPost = handlers.POST

type RouteHandler = typeof nextGet
type RouteRequest = Parameters<RouteHandler>[0]

async function wrap(
  handler: RouteHandler,
  req: RouteRequest,
): Promise<Response> {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    return handler(req)
  }
  const response = await handler(req)
  return finalizeAuthResponse(response, secret)
}

export const GET = (req: RouteRequest) => wrap(nextGet, req)

export const POST = (req: RouteRequest) => wrap(nextPost, req)
