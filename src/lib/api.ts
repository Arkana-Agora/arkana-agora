"use client"

import axios, {
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios"
import { getSession } from "next-auth/react"

import {
  clearCachedAccessToken,
  getCachedAccessToken,
  invalidateSessionCache,
  refreshAccessTokenOnce,
  resolveAccessToken,
} from "@/lib/auth-refresh"

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

async function getAccessToken(): Promise<string | null> {
  return resolveAccessToken(async () => {
    const session = await getSession()
    return session?.accessToken ?? null
  })
}

const SENSITIVE_HEADERS = new Set(["set-cookie", "x-request-id"])

const fetchAdapter: AxiosAdapter = async (config) => {
  const baseURL = config.baseURL ?? ""
  const path = config.url ?? ""
  const url = new URL(baseURL + path, window.location.origin).href

  const headers: Record<string, string> = {}
  if (config.headers) {
    for (const [key, value] of Object.entries(config.headers)) {
      if (value !== undefined) headers[key] = String(value)
    }
  }

  const init: RequestInit = {
    method: config.method?.toUpperCase() ?? "GET",
    headers,
    credentials: "include",
  }
  if (config.data && config.method?.toUpperCase() !== "GET") {
    init.body =
      typeof config.data === "string"
        ? config.data
        : JSON.stringify(config.data)
  }

  const res = await fetch(url, init)
  const data = await res.json().catch(() => null)

  const filteredHeaders: Record<string, string> = {}
  for (const [key, value] of res.headers.entries()) {
    if (!SENSITIVE_HEADERS.has(key.toLowerCase())) {
      filteredHeaders[key] = value
    }
  }

  const response: AxiosResponse = {
    data,
    status: res.status,
    statusText: res.statusText,
    headers: filteredHeaders,
    config,
  }

  if (res.status >= 200 && res.status < 300) {
    return response
  }

  const error = new axios.AxiosError(
    `Request failed with status ${res.status}`,
    String(res.status),
    // Strip Authorization from error config to avoid token exposure in logs
    {
      ...config,
      headers: Object.fromEntries(
        Object.entries(
          config.headers?.toJSON?.() || config.headers || {},
        ).filter(([k]) => k.toLowerCase() !== "authorization"),
      ) as InternalAxiosRequestConfig["headers"],
    },
    undefined,
    response,
  )
  throw error
}

const authApi = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
  adapter: fetchAdapter,
})

authApi.interceptors.request.use(async (config) => {
  // Cache ownership lives in @/lib/auth-refresh (get/set/invalidate); never
  // write the token cache here. Only inject a Bearer token when the caller
  // did not provide one already.
  const existingHeader = config.headers.get("authorization")
  const existing =
    typeof existingHeader === "string"
      ? existingHeader.replace(/^Bearer\s+/i, "").trim()
      : ""

  const token = existing || getCachedAccessToken() || (await getAccessToken())
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`)
  }
  return config
})

authApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableConfig | undefined
    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error)
    }
    if (originalRequest._retry) {
      return Promise.reject(error)
    }
    originalRequest._retry = true

    const outcome = await refreshAccessTokenOnce()

    if (outcome.kind !== "success") {
      return Promise.reject(error)
    }

    // Support both AxiosHeaders (has .set) and plain object mocks
    if (typeof originalRequest.headers.set === "function") {
      originalRequest.headers.set(
        "Authorization",
        `Bearer ${outcome.accessToken}`,
      )
    } else {
      originalRequest.headers["Authorization"] = `Bearer ${outcome.accessToken}`
    }
    return authApi(originalRequest)
  },
)

export function resetAuthApiSessionCache() {
  invalidateSessionCache()
  clearCachedAccessToken()
}

interface AuthStreamOptions {
  method?: string
  body?: unknown
  _retry?: boolean
}
// Fetch autenticado para respostas nao-JSON (SSE streaming). Reusa o mesmo
// fluxo single-flight de refresh do authApi (auth-refresh) sem duplicar a
// injecao do token.
export async function authStreamFetch(
  path: string,
  options: AuthStreamOptions = {},
): Promise<Response> {
  if (!path.startsWith("/api/"))
    throw new Error("Invalid path: must start with /api/")
  const attempt = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {}
    if (options.body !== undefined) headers["Content-Type"] = "application/json"
    if (token) headers.Authorization = `Bearer ${token}`
    headers.Accept = "text/event-stream"

    const init: RequestInit = {
      method: options.method ?? "GET",
      credentials: "include",
      headers,
    }
    if (options.body !== undefined) init.body = JSON.stringify(options.body)
    return fetch(path, init)
  }

  const token = getCachedAccessToken() || (await getAccessToken())
  const res = await attempt(token)

  if (res.status === 401 && !options._retry) {
    const outcome = await refreshAccessTokenOnce()
    if (outcome.kind === "success") {
      return attempt(outcome.accessToken)
    }
  }

  return res
}

export default authApi
