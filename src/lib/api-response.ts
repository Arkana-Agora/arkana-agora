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
): Response {
  const body: ApiError = {
    error: { code, message, ...(details ? { details } : {}) },
    meta: { requestId: reqId },
  }
  return Response.json(body, { status })
}

export function apiSuccess(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}
