/**
 * Creates an AuthTokenError-like object for testing token validation failures.
 * Used across integration tests where the real AuthTokenError class is mocked.
 */
export function createTokenError(code: string): Error {
  const err = new Error(`${code}: test`)
  err.name = "AuthTokenError"
  ;(err as { code?: string }).code = code
  return err
}
