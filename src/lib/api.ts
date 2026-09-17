"use client"

import axios, {
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios"
import { getSession } from "next-auth/react"

const REFRESH_URL = "/api/v1/auth/refresh"
const REFRESH_TIMEOUT_MS = 15_000

let refreshPromise: Promise<string | null> | null = null

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

export async function refreshTokens(): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS)

    const res = await fetch(REFRESH_URL, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) return null

    const data = await res.json().catch(() => null)
    if (
      data &&
      typeof data === "object" &&
      "accessToken" in data &&
      typeof data.accessToken === "string"
    ) {
      return data.accessToken
    }
    return null
  } catch {
    return null
  }
}

async function getAccessToken(): Promise<string | null> {
  const session = await getSession()
  return session?.accessToken ?? null
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
    config,
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
  const token = await getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
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

    if (!refreshPromise) {
      refreshPromise = refreshTokens().finally(() => {
        refreshPromise = null
      })
    }
    const newToken = await refreshPromise

    if (!newToken) {
      return Promise.reject(error)
    }

    originalRequest.headers.Authorization = `Bearer ${newToken}`
    return authApi(originalRequest)
  },
)

export default authApi
