# Runbook — All API calls 401 / infinite refresh / login flicker (JWT_PUBLIC_KEY missing)

## Summary

Every authenticated API call (`/users/me/profile`, `/readings/...`, `/ai/...`) answers `401 AUTH_TOKEN_INVALID` even though login succeeded and the Auth.js session cookie exists. The server-side interceptor keeps refreshing (refresh usually returns 200) but the retried request is rejected again — an endless 401 → refresh → retry loop that makes the UI churn, flash the login screen, and bounce away from `/dashboard`/`/perfil`/`/tirar`.

Root cause: `verifyAccessToken()` (src/services/token-service.ts) parses the RSA public key **inside** the `jwtVerify` try/catch. When `JWT_PUBLIC_KEY` is absent in the runtime environment, `createPublicKey()` throws, the catch swallows it, and EVERY token is reported as `AUTH_TOKEN_INVALID` — including tokens just minted with the valid `JWT_PRIVATE_KEY`.

## Trigger

- Browser: dashboard flashes login, pages bounce back to `/login`, `AuthGuard` loops.
- DevTools → Network: client API calls return `401 {"code":"AUTH_TOKEN_INVALID"}` while `POST /api/v1/auth/refresh` returns 200; repeat.
- Server log: repeated `[auth:token] token invalido ou expirado` with no preceding `[auth:config]` error.

## Preconditions

- Access to the runtime env files/console where `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` live.
- A keygen tool (OpenSSL or Node): both keys must come from the SAME pair.

## Steps

1. Confirm `JWT_PUBLIC_KEY` is present and parseable in the **runtime** env (NOT just `.env.example`):
   - Local: `bun run dev` loads `.env.local` (Next) over `.env` (bun scripts). A quoted multi-line PEM block loads correctly under bun but may break under plain dotenv loaders — prefer the multiline PEM form.
   - Vercel/Railway: check the project env var; remember pasting a PEM as a single line with `\n` inside a JSON value breaks the key.
2. If `.env.local` only has `JWT_PRIVATE_KEY`, derive the matching public key and add it in the same PEM block format (see `docs/07-security/security.md` §JWT / keypair generation).
3. Restart the dev server (`bun run dev`) — env vars are read at process start.
4. Sign in again. First API call must return a real payload (or a legitimate per-endpoint error), not `AUTH_TOKEN_INVALID`; the terminal must now log `[auth:config]` **only** if a key is actually broken.
5. Smoke-test the guard: navigate `/dashboard` → `/perfil` → `/tirar`; the pages must stay mounted (no login flash), and deck-art fallbacks (gradient placeholder) must render instead of broken images while `/images/decks/**` is absent.

## Escalation

- If `[auth:config] JWT_PUBLIC_KEY ausente ou invalida` appears after the fix, the key value is malformed or the pair mismatched — regenerate the PAIR together (private + public) and redeploy both; a 90-day rotation must replace both keys in the same deploy.
- Production: deploy the new public key before (or with) the new private key; tokens signed by an old private key fail against a new public key for their remaining TTL.

## Post-incident

- Add the missing key to the target environment(s) and record it in `docs/environments.md`.
- Keep `.env.example` documenting both vars; never commit real keys.
- After this fix, config faults answer HTTP 500 (`AUTH_CONFIG_INVALID_PUBLIC_KEY`), distinct from client-side 401 — grep `[auth:config]` in logs to distinguish env breakage from genuine token expiry.