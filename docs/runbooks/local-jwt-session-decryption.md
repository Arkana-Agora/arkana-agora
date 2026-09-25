# Runbook — JWTSessionError "no matching decryption secret" (local)

## Summary

Auth.js fails to decrypt `authjs.session-token` / `__Secure-authjs.session-token` because the cookie was minted with a different `AUTH_SECRET` than the one currently loaded. `GET /api/auth/session` still returns 200 with a null session; the error is noisy but not a hard 500.

## Trigger

- Console/server: `JWTSessionError: no matching decryption secret`
- User appears logged out despite a session cookie present
- After rotating `AUTH_SECRET`, or after loading the app with a stale browser cookie from another env/secret

## Preconditions

- Local access to the app (`bun run dev`)
- Browser DevTools (or curl) for cookie inspection
- Read access to local env files (values must never be committed or pasted into tickets)

## Steps

1. Confirm `AUTH_SECRET` is defined for the running process:
   - Next loads `.env.local` over `.env`; Auth.js uses **`AUTH_SECRET` only** (ADR-010 — not `NEXTAUTH_SECRET`).
   - Locally, `AUTH_SECRET` typically comes from `.env`.
2. Clear site cookies for `http://localhost:3000` (DevTools → Application → Cookies → clear), or delete only the Auth.js session cookie names above.
3. Restart `bun run dev` if `AUTH_SECRET` was changed in env files.
4. Sign in again; `JWTSessionError` must not reappear on `/api/auth/session`.
5. If the error persists with a freshly issued cookie, `AUTH_SECRET` is empty or differs between process start and the mint path — fix env, restart, clear cookies again.

## Escalation

- Production/Vercel: ensure project env `AUTH_SECRET` matches across Preview/Production (see `vercel-deploy-auth-url.md` for related AUTH_* gates). Never commit secrets.

## Post-incident

- Keep `AUTH_SECRET` stable per environment; rotating requires clearing user session cookies (all sessions become invalid by design).
- Prefer documenting the rotation in `docs/environments.md` rather than changing ADRs.
