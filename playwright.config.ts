import { defineConfig, devices } from "@playwright/test"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"

const JWT_PRIVATE_KEY =
  process.env.JWT_PRIVATE_KEY ??
  `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7JX6HR6mzNmVFNqmbibR2nP6w7oaKYjPKPHvobfwqs2IE6x7h1K3h3rdFx9O8N0wCdA95w86VHSvVAnwmxt38gAWoK4WXcU7f4BO9OFlrfmtRpwXy4WOZF4TVjXFiH2499T1I5SoH77R7BXOJoOFC4XIcH0nymBOuP0OE3d+C9VQi2P+UgHxNZauTEI2VEuY117Wfq6bFZecAbqMOv9FoYVCEM6pWRMICKkaJs6flCzIRXnOQPUGWS9cqPhB4zEgoEXWSQm9v6jBcyYJslhPekl5kg8B5Z1hXJnTL8QxD2eLRIzPiyxbiRRgX3IRBA0Gx57FVJSRtXcSoQSWGk/HJAgMBAAECggEAE3n89449OoH0OyZLs3y608dV+ErypI9AzZDK4m8j2bvOfS2NCrqsGAAqObBouENW/UBf5e+7XahqCeKW0iBLNP6L2CsjXZX0u/bhhwVIxRekipxj0ZmkWGfqsqDkRm539inCJYZ3/9hyA4WXNyEPoHq++e9FrmImVjGOUNMYclPw+mtQy4xEHWL0FDjIVFVs1RctP++JRlSJ4rEYOJewOXvBT7WO+bCx2MRd7y/PgxH2R9ML9LBpVcjZYMI8r2w4x3LtYeEMjQPK7CIbpzntq6hZ1slNh13mR8uQzYlOSfHksb45gs5aQHcywLWdjm6mPXRJBrhUau2CwD+VXqcEmwKBgQD2hY2uS5pj0vDZtZJUFFJmq46IAjSvWJJy0SZbbO/GCXDPOKT5q4puolzLxzdbP/TEBJDt065OITKYNtgfLLjyJYDC4JFRx63CibgAwjY6U7nbJ3iuOSnN3qp8yB+wjvNU0lfni8lb8wdgSwLcDqqA8qXCsJtHyQJWWGklITzP/wKBgQDCV4bDX8rNZ6FpTtT2q2GDLi1j7CTQzscY2yade96KFDEDyHmgbJWFtWjTJmkOSWl6sCz16qLhbwx6cB566MOppd4Um8scV1GehwrVX1KCpez4AFOrNsjXq6rh7CE8qB0Mde4Gu2pCjSXpzH+kB1M6naUdxC9cyrgwcj/yf9y+NwKBgQDz1vZlSHLV+ngxX9/1OoSm+VpqPYRPTJTO7QG7vO0OPZhP3/+O1ZaACCkxh0PCBmjc2odgNtlafovE87qiW2I0YdQS7n3PHmtI2WAfn/pzhw13MHu2GOS4tV59PpXZ1gvqAoTgiuwI/0J0hL23XOpZ0akUAgwV3UVqktit2UqFkQKBgQC3DwMd3YmGWess6tinUV+U1VZkHPfAyEW6IBQLm7ZPkh1pVtlaR23AeNS4sCGdF4GH05NGQTIT7ypt2labp81Ga7r45pc3pvh2vvVxb0ylS+4e3Q/y4rPkkwtvq6DTJffW2O7Q4JCDB7mCtOI2e7/mIsB5fWavnTRKThP2NIKVmQKBgF/nKBX+qXM/7WEHjJMQBzckr8J2M88OWyqnaTXqvjevCqD62EK3UVLPYuKXrd5TLJ0ycbkgORxKvKX+kMLCTDSSfJdeN3BduuAPBlk91vJrxx6wUksPba/72K6FIkCqhmokZB01JbKCP+e1hBdYO1uY+yrb715gSk0/Hsvf0wmh
-----END PRIVATE KEY-----`

const JWT_PUBLIC_KEY =
  process.env.JWT_PUBLIC_KEY ??
  `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuyV+h0epszZlRTapm4m0dpz+sO6GimIzyjx76G38KrNiBOse4dSt4d63RcfTvDdMAnQPecPOlR0r1QJ8Jsbd/IAFqCuFl3FO3+ATvThZa35rUacF8uFjmReE1Y1xYh9uPfU9SOUqB++0ewVziaDhQuFyHB9J8pgTrj9DhN3fgvVUItj/lIB8TWWrkxCNlRLmNde1n6umxWXnAG6jDr/RaGFQhDOqVkTCAipGibOn5QsyEV5zkD1BlkvXKj4QeMxIKBF1kkJvb+owXMmCbJYT3pJeZIPAeWdYVyZ0y/EMQ9ni0SMz4ssW4kUYF9yEQQNBseexVSUkbV3EqEElhpPx
yQIDAQAB
-----END PUBLIC KEY-----`

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      JWT_PRIVATE_KEY,
      JWT_PUBLIC_KEY,
    },
  },
})
