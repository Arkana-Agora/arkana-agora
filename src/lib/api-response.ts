export interface ApiError {
  error: { code: string; message: string; details?: unknown }
  meta?: { requestId: string }
}

export function apiError(
  code: string,
  message: string,
  reqId: string,
  status: number,
  details?: unknown,
  headers?: Record<string, string>,
): Response {
  const body: ApiError = {
    error: { code, message, ...(details ? { details } : {}) },
    meta: { requestId: reqId },
  }
  const init: ResponseInit = { status }
  if (headers) init.headers = headers
  return Response.json(body, init)
}

export function apiSuccess(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}
