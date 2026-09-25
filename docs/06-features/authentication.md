# Autenticação — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Autenticação | **Versão**: MVP

---

## Descrição

O módulo de autenticação do **Arkana Agora** é responsável por gerenciar o ciclo de vida do usuário, desde o login inicial até o encerramento da conta. A camada de login do MVP é o **Auth.js v5** (`next-auth@5.0.0-beta.32` pinado — ADR-010, que supersede a cláusula "NextAuth.js v4 + adapter Prisma" do ADR-009) com **adapter Prisma mínimo** e estratégia de sessão **JWT**: **Google OAuth** e **magic link** são os fluxos do MVP, e a sessão real é o **cookie JWT do Auth.js** exposto em `/api/auth/*` (handler em `src/app/api/auth/[...nextauth]`). A **Custom JWT Layer** (access RS256 de 15 min + refresh rotativo de 30 dias, ADR-009 Gate B) é o estado-alvo da **Sprint 1**, com ponto de anexo nos callbacks `jwt`/`session` de `src/auth/auth.config.ts`. Facebook OAuth e as rotas `/api/v1/auth/*` (incluindo o rate limit de magic link) também são **Sprint 1** — o login por e-mail/senha (credentials) já foi entregue na Sprint 1: backend `POST /api/v1/auth/login` (T7) + frontend `LoginForm` (T19).

O magic link usa o `EmailProvider` do Auth.js (id `"email"`, callback `/api/auth/callback/email`): token **single-use** com validade de **15 minutos** via model `VerificationToken` (`type = "MAGIC_LINK"`, deletado na redenção); em dev, sem SMTP, `AUTH_EMAIL_SKIP_SEND=true` loga o link no console em vez de enviar.

**Dois fluxos de e-mail (não conflitantes):** (1) o magic link do MVP usa o `EmailProvider` do Auth.js via **nodemailer/SMTP** (`src/auth/auth.config.ts`, vars `SMTP_*`/`EMAIL_FROM`); (2) os e-mails transacionais das rotas REST `/api/v1/auth/*` (verificação de e-mail, reset de senha, magic link) usam o **Resend** via `src/lib/email/email.ts` (helpers `sendVerificationEmail`/`sendPasswordResetEmail`/`sendMagicLinkEmail`/`sendAccountDeletionEmail`/`sendAccountDeletedFinalEmail`, implementado no T3/T16), com guard de dev `AUTH_EMAIL_SKIP_SEND=true` (`NODE_ENV=development` obrigatório). O vínculo OAuth usa `User.provider`/`providerId` (`@@unique([provider, providerId])`, normalização H-2) — sem model `Account` no MVP (provedor único por usuário). A recuperação de senha e a exclusão completa da conta seguem o design de `docs/04-api/authentication.md` e `.specs/001-auth/design.md` (Sprint 1), em conformidade com a LGPD (soft delete com janela de 30 dias + hard delete anonimização).

---

## Funcionalidades

- **Login por magic link** — MVP: `EmailProvider` do Auth.js, token single-use válido por 15 minutos (`VerificationToken`, `type = "MAGIC_LINK"`)
- **Login via OAuth (Google)** — MVP: vínculo via `User.provider`/`providerId`, sem model `Account` (provedor único no MVP); provider condicional a `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`
- **Sessão JWT do Auth.js** — MVP: cookie JWT (`session: { strategy: "jwt" }`), sem gravação de sessão no banco
- **Proteção de rotas** — MVP (três camadas): (1) `src/proxy.ts` (Next 16, matcher `/dashboard/:path*`, `/perfil/:path*`, `/tirar`, `/tiragem/:path*`, `/minhas-tiragens`, `/meu-arcano/:path*`, validando via `getToken({ secret: AUTH_SECRET })` e setando `?callbackUrl=` ao redirecionar para `/login`) + (2) guard de auth no layout do route group `src/app/(app)/layout.tsx` (server component: `auth()` e `redirect("/login")` sem sessão — adicionado na F2B, defesa em profundidade) + (3) `AuthGuard` client-side (`src/components/auth/auth-guard.tsx`, T24 — componente `"use client"` que inicia com `checked=false` (skeleton `role="status"`, sem trust em estado persistido), **valida a sessão pós-montagem** via `refreshSession()` do auth-store em `useEffect` (guard `checked` + cancellation flag — executa uma vez), redireciona `router.replace("/login")` se `!isAuthenticated` ou role mismatch, renderiza `children` somente após `checked && isAuthenticated && role passa`; suporta `requiredRole?: UserRole` (`"USER" | "PROFESSIONAL" | "ADMIN"`) — `passesRole` exige `"role" in user` (PartialUser nunca satisfaz role exigida))
- **Logout no dashboard** — `src/app/(app)/dashboard/page.tsx` renderiza o client `<LogoutButton />` (`src/components/auth/logout-button.tsx`) — **não** um server action `signOut` (o server action antigo deixava a família de refresh válida e o localStorage populado); clique → `useAuthStore.logout()` (best-effort: resolve access token via `getSession()` + `POST /api/v1/auth/logout` com Bearer → `signOut({ redirect: false })` → limpa `user`/`isAuthenticated` → `resetAuthApiSessionCache()` (= `clearCachedAccessToken()` + `invalidateSessionCache()`, `src/lib/auth-refresh.ts`) + `resetUser()` (reset de identidade PostHog — re-afirma opt-out quando o consentimento está revogado) → deleta Cache Storage `arkana-agora-*`) → em `finally`: `router.replace("/login")` + `router.refresh()`; botão desabilitado com "Saindo..." durante `pending`
- **Cadastro por e-mail e senha** — Sprint 1: **T6 implementado** — `POST /api/v1/auth/register` (validação de formato/força da senha via Zod, hash bcrypt custo 12, verificação de e-mail com token 24h; **não faz auto-login**)
- **Verificação de e-mail** — Sprint 1: **T30 implementado** — `POST /api/v1/auth/verify-email` (redime `VerificationToken type=EMAIL` single-use 24h; 401 `AUTH_EMAIL_VERIFY_INVALID` / 410 `AUTH_EMAIL_VERIFY_EXPIRED`; guarda LGPD; marca `emailVerified` + `bumpTokenVersion`) e `POST /api/v1/auth/verify-email/resend` (reenvio anti-enumeração, 200 uniforme; rate limit 1/min por e-mail + 5/h por IP `MAX_VERIFY_EMAIL_RESEND_IP_ATTEMPTS`, IP checado/registrado antes do lookup)
- **Login por e-mail e senha** — Sprint 1: **T7 implementado** — `POST /api/v1/auth/login` (Zod `loginSchema`, lockout de conta 5 falhas/15min, rate limit por IP 5/15min, anti-enumeração — branch user-not-found com piso de timing `equalizeNoopTiming()` 240–400ms —, access RS256 + refresh session 30d; **CSRF (2026-09-18)**: valida double-submit via `validateCsrfToken` (`src/lib/csrf`, comparação `timingSafeEqual` sobre buffers UTF-8 com checagem de byte-length; nome do cookie centralizado em `src/lib/csrf-cookie-name.ts`) logo após a validação do body — 403 `CSRF_TOKEN_INVALID` antes de qualquer efeito colateral (lockout/rate limit/bcrypt/DB), mesmo padrão do register; **ADR-011**: no sucesso também cunha o cookie de sessão do Auth.js — `authjs.session-token`/`__Secure-authjs.session-token` via `mintAuthJsSessionCookie` (`encode` de `next-auth/jwt`), **antes** de montar a resposta (fail-fast se `AUTH_SECRET` ausente) — para os guards do `/dashboard` reconhecerem o login por credenciais)
- **LoginForm (frontend)** — Sprint 1: **T19 implementado** — `src/app/(auth)/login/login-form.tsx` rework: campos e-mail + senha com toggle de visibilidade (`aria-label` "Mostrar senha"/"Ocultar senha"), validação client-side via react-hook-form + `zodResolver(loginSchema)` (de `src/lib/validators/auth.ts`), botão "Entrar" com loading; chama `useAuthStore.login(email, password)` (POST `/api/v1/auth/login`); **callbackUrl seguro (2026-09-24)**: lê `?callbackUrl=` via `useSearchParams` com validação via `isSafeCallbackPath` compartilhado (`src/hooks/use-safe-callback-url.ts` — leading `/`, decode percentual com rejeição de malformado, igualdade de origem WHATWG; fallback `/dashboard`); a página `login/page.tsx` monta `AuthSessionBridge` + `LoginForm` dentro de `<Suspense fallback={null}>` (requisito do `useSearchParams` no App Router); se já autenticado, efeito de mount chama `refreshSession()` e só redireciona com `router.replace(callbackUrl)` quando a ida ao servidor retornar `ok` **e** o store confirmar `isAuthenticated` (guard fail-safe — `refreshSession()` resolve `true` mesmo quando `/refresh` volta 200 sem user payload/sessão persistida ausente); em sucesso `router.push(callbackUrl)` + `router.refresh()`; `AUTH_EMAIL_NOT_VERIFIED` → `/verify-email?email=...`; mapeia `AUTH_INVALID_CREDENTIALS`/`AUTH_ACCOUNT_SUSPENDED`/`AUTH_ACCOUNT_LOCKED`/`AUTH_RATE_LIMITED`/`VALIDATION_ERROR` para mensagens amigáveis; Google via `signIn("google", { callbackUrl })` em `handleGoogleSignIn` — **mesmo callbackUrl dinâmico** (não mais hardcoded `/dashboard`; try/catch: `NEXT_REDIRECT` é engolido, demais erros mapeados para mensagem amigável); `src/proxy.ts` popula `?callbackUrl=` com o pathname ao redirecionar para `/login`; links para `/magic-link`, `/forgot-password` e `/register`; **cookie CSRF (2026-09-23; store authoritative 2026-09-24)**: definido **client-side** por `ensureCsrfCookie()` (`src/lib/csrf-client.ts`) em `login()` do store imediatamente antes do POST — mount `useEffect` do `LoginForm` removido por ser redundante (`csrf-token` em dev / `__Host-csrf-token` em produção, `httpOnly: false`, `sameSite: strict`, `path: /`, 24h) — `cookies().set()` em Server Component é ilegal no App Router do Next 16 (sem cookie, o POST de login falha com 403 `CSRF_TOKEN_INVALID`)
- **RegisterForm (frontend)** — Sprint 1: **T20 implementado** — `src/app/(auth)/register/register-form.tsx`: campos **nome de exibicao**, **e-mail**, **senha** (toggle visibilidade), **confirmar senha**, **indicador de força de senha em tempo real** (aparece quando senha não vazia; barra progressiva + label "Fraca"/"Media"/"Forte" via `getPasswordStrength` de `src/lib/password-strength.ts` — critérios espelham `passwordSchema`: ≥8 chars, maiúscula, minúscula, número, especial; score 0–2=fraca, 3–4=media, 5=forte), **checkbox "Aceito os Termos de Uso e a Politica de Privacidade"**, botão "Criar conta" com loading; validação client-side via react-hook-form + `zodResolver(registerSchema)` (de `src/lib/validators/auth.ts`); chama `useAuthStore.register(data)` (POST `/api/v1/auth/register`); em 201 exibe mensagem inline "Conta criada! Verifique seu e-mail para ativar."; mapeia erros do servidor: `AUTH_EMAIL_ALREADY_EXISTS` → "E-mail ja cadastrado", `VALIDATION_ERROR` → "Dados de entrada invalidos", genérico → "Erro ao criar conta"; link "Entrar" para `/login`; **cookie CSRF (2026-09-23; store authoritative 2026-09-24)**: definido **client-side** por `ensureCsrfCookie()` (`src/lib/csrf-client.ts`) em `register()` do store imediatamente antes do POST — mount `useEffect` do `RegisterForm` removido por ser redundante (mesmo contrato do LoginForm — `cookies().set()` em Server Component é ilegal no App Router do Next 16, sem cookie o POST falha com 403 `CSRF_TOKEN_INVALID`)
- **ForgotPasswordForm (frontend)** — Sprint 1: **T22 implementado** — `src/app/(auth)/forgot-password/forgot-password-form.tsx`: campo único de e-mail (react-hook-form + `zodResolver(forgotPasswordSchema)` de `src/lib/validators/auth.ts`), botão "Enviar link de recuperacao" com loading; chama `useAuthStore.forgotPassword(email)` (POST `/api/v1/auth/forgot-password`); em sucesso substitui o formulário por painel `role="status"` com a mensagem da API ("Se o e-mail estiver cadastrado, voce recebera instrucoes...") + link "Voltar ao login"; mapeia `AUTH_FORGOT_RATE_LIMIT` → "Muitos pedidos de recuperacao de senha, tente novamente mais tarde", `NETWORK_ERROR` → "Erro ao enviar link de recuperacao", `UNEXPECTED_RESPONSE` → "Resposta inesperada do servidor", `UNKNOWN_ERROR` → "Erro inesperado, tente novamente"; footer "Entrar" link para `/login`; página em `src/app/(auth)/forgot-password/page.tsx` (metadata "Recuperar senha — Arkana Agora", `ThemeToggle`, Card, espelha a página do magic link)
- **ResetPasswordForm (frontend)** — Sprint 1: **T23 implementado** — `src/app/(auth)/reset-password/reset-password-form.tsx`: campos **Nova senha** e **Confirmar nova senha** (ambos `autoComplete="new-password"`, react-hook-form + `zodResolver(resetPasswordFormSchema)` de `src/lib/validators/auth.ts` — mesmas regras do cadastro via `passwordSchema` + refine de confirmação); token recebido via prop `token` (query param `?token=...` da página `src/app/(auth)/reset-password/page.tsx`, server component que aguarda `searchParams` async do Next 16); token ausente/vazio é tratado **server-side** na `page.tsx` (painel "Link de redefinicao de senha invalido" com link "Solicitar novo link" → `/forgot-password`, **sem chamada de API** — o form nem monta sem token); chama `useAuthStore.resetPassword({ token, password, passwordConfirmation })` (POST `/api/v1/auth/reset-password`); em sucesso substitui o formulário por painel `role="status"` com a mensagem da API ("Senha redefinida com sucesso") + "Redirecionando para o login..." e redireciona via `router.replace("/login")` após 2s (sucesso decoupled da mensagem via booleano dedicado — cobre `message: ""`); token removido da URL via `history.replaceState` antes do redirect; mapeia erros por `ResetPasswordErrorCode`: `AUTH_RESET_TOKEN_INVALID` → "Link de redefinicao de senha invalido", `AUTH_RESET_TOKEN_EXPIRED` → "Sessao de redefinicao expirada, solicite um novo link", `VALIDATION_ERROR` → "Dados de entrada invalidos", `NETWORK_ERROR` → "Erro ao redefinir a senha", `UNEXPECTED_RESPONSE` → "Resposta inesperada do servidor", `UNKNOWN_ERROR` → "Erro inesperado, tente novamente"; loading via `isSubmitting` do RHF; página em `src/app/(auth)/reset-password/page.tsx` (metadata "Redefinir senha — Arkana Agora", `ThemeToggle`, Card)
- **AuthStore (Zustand)** — Sprint 1: **completo (T19–T25)** — `src/stores/auth-store.ts` com `user`, `isAuthenticated`, `isLoading`, `error`, `login(email, password)` (POST `/api/v1/auth/login`; **2026-09-23**: garante e lê o cookie CSRF via `ensureCsrfCookie()` de `src/lib/csrf-client.ts` — `csrf-token`/`__Host-csrf-token` por `NODE_ENV` (nomes centralizados em `src/lib/csrf-cookie-name.ts`) — e o envia como header `x-csrf-token`, espelhando o `register()`), `register(registerData: RegisterInput)` (POST `/api/v1/auth/register`), `sendMagicLink(email: string)` (POST `/api/v1/auth/magic-link`), `forgotPassword(email: string)` (POST `/api/v1/auth/forgot-password`), `resetPassword(data: ResetPasswordInput)` (POST `/api/v1/auth/reset-password`), `refreshSession(): Promise<boolean>` (delega a `refreshAccessTokenOnce()` de `src/lib/auth-refresh.ts` — single-flight compartilhado com o interceptor axios; sucesso com `data.user` atualiza o user do servidor via `toStoredUser`; sucesso só com `accessToken` **mantém** o user persistido e deriva `isAuthenticated` de `emailVerified`; `network_error`/`server_error` **não** deslogam — setam error transitório e retornam `false`; `auth_failed`/`bad_response` limpam `user` e setam `error`; retorna boolean — T24/F1), `loginWithGoogle(callbackUrl?)` (`signIn("google", { callbackUrl: callbackUrl ?? "/dashboard" })` — parâmetro opcional com default `/dashboard`; o `LoginForm` não a usa, chama `signIn` direto com callbackUrl validado), `logout()` (resolve access token via `getSession()` + cache de `src/lib/auth-refresh.ts` e chama `POST /api/v1/auth/logout` com Bearer — best-effort, sempre limpa o estado local + `resetAuthApiSessionCache()` + `resetUser()` (PostHog) + deleta Cache Storage `arkana-agora-*`), `deleteAccount(email)` (`DELETE /api/v1/auth/account` com `{ email: email.trim() }` e Bearer; limpa o estado **apenas se `res.ok`**, `error: "Erro ao excluir conta"` em qualquer falha — HTTP não-ok ou rede —, `Sessao expirada, faca login novamente` sem Bearer) e `clearError`; **review (Step 4)**: `logout` sempre chama `signOut({ redirect: false })` (encerra também o cookie de sessão Auth.js), `deleteAccount` chama `signOut({ redirect: false })` após `res.ok`, `toStoredUser` deriva via `emailVerified ?? true`, `merge` valida a forma do dado persistido (`isStoredUser` — malformado/tamperado descarta user, fail closed); **T25 (F7)**: `User` ganhou `emailVerified: boolean` (derivado de `user.emailVerified !== null` — S12), `PartialUser` (C9) — login 401 `AUTH_EMAIL_NOT_VERIFIED` guarda `{ email: email.trim(), emailVerified: false }` com `isAuthenticated=false`; `isAuthenticated` é **derivado** de `user != null && user.emailVerified` (login/verifyMagicLink sucesso via `toStoredUser`, refreshSession deriva do user atual); store embrulhado no middleware `persist` do Zustand (chave `arkana-auth`, localStorage, `partialize` persiste só `user`, `merge` reidrata e deriva `isAuthenticated` — PartialUser reidratado não autentica); `error` auto-limpa após 5s via timer no store (set embrulhado, sem useEffect); `login()`, `register()`, `sendMagicLink()`, `forgotPassword()` e `resetPassword()` endurecidos (review 6-agentes): try/catch/finally com `isLoading` sempre resetado, respostas tipadas via parsing type-safe sem `as` casts inseguros nas ações (login/register anotam `res.json()` como `unknown`; erros parseados pelo helper compartilhado `parseErrorResponse`, que valida `{ error: { code, message, retryAfter? } }`), sucesso detectado estruturalmente (`res.ok && typeof data.message === "string"` — sem depender do texto anti-enumeração), `sendMagicLink` retornando `MagicLinkResult` (união discriminada `{ success: true, message? } | { success: false, code, message?, retryAfter? }` — 429 repassa `retryAfter`) e `forgotPassword` retornando `ForgotPasswordResult` (união discriminada `{ success: true, message? } | { success: false, code, message? }` — sem `retryAfter`; `ForgotPasswordErrorCode` = `"AUTH_FORGOT_RATE_LIMIT" | "VALIDATION_ERROR" | "NETWORK_ERROR" | "UNEXPECTED_RESPONSE" | "UNKNOWN_ERROR"`) e `resetPassword` retornando `ResetPasswordResult` (união discriminada `{ success: true, message? } | { success: false, code, message? }` — sem `retryAfter`; `ResetPasswordErrorCode` = `"AUTH_RESET_TOKEN_INVALID" | "AUTH_RESET_TOKEN_EXPIRED" | "VALIDATION_ERROR" | "NETWORK_ERROR" | "UNEXPECTED_RESPONSE" | "UNKNOWN_ERROR"`; token vazio → `AUTH_RESET_TOKEN_INVALID` sem fetch; resposta não-JSON → `UNEXPECTED_RESPONSE`; `TypeError` → `NETWORK_ERROR` "Erro ao redefinir a senha"), normalização de códigos via helper simplificado `normalizeAuthErrorCode(code, knownCodes)` (sem genérico, recebe `readonly string[]`, retorna `string`) compartilhado por `normalizeMagicLinkCode`/`normalizeForgotPasswordCode`/`normalizeResetPasswordCode` (código desconhecido do servidor → `UNKNOWN_ERROR`), `User` alinhado ao payload da API (`{ id, name, email, displayName, role, plan, avatar }`, sem `emailVerified`) e `export type { User }`; **register não faz auto-login** — `isAuthenticated` permanece `false`, `user` permanece `null`; `sendMagicLink`, `forgotPassword` e `resetPassword` não autenticam — apenas enviam o link, `isAuthenticated` permanece `false`, `user` permanece `null`; `forgotPassword` com e-mail vazio → `VALIDATION_ERROR` sem fetch, 429 `AUTH_FORGOT_RATE_LIMIT` (sem `retryAfter`), resposta não-JSON → `UNEXPECTED_RESPONSE`, `TypeError` → `NETWORK_ERROR` "Erro ao enviar link de recuperacao"; persistência (T25) e interceptor Axios (T26) pendentes
- **Refresh de token** — Sprint 1: **T13 implementado** — `POST /api/v1/auth/refresh` (lê `refreshToken` do cookie httpOnly, chama `rotateRefresh` — rotação **transacional** anti-race com revalidação atômica de `revokedAt`/`expiresAt`, `signAccessToken` antes da transação — rotação com mesmo `familyId`, reuso revoga família, `200 { accessToken, expiresIn }` + Set-Cookie; no sucesso também cunha o cookie de sessão do Auth.js via `mintAuthJsSessionCookie`, ADR-011)
- **Logout** — Sprint 1: **T14 implementado** — `POST /api/v1/auth/logout` (lê access token do `Authorization: Bearer`, verifica via `verifyAccessToken`, delega revogação a `revokeRefreshSession`/`revokeAllSessions` do `token-service.ts`, limpa cookie de refresh **e expira o cookie de sessão do Auth.js** via `buildSessionExpireCookie` — ADR-011, `200 { message }` flat)
- **Login via OAuth (Facebook)** — Sprint 1 (não faz parte da camada de login do MVP, ADR-010)
- **Recuperação de senha** — Sprint 1: **T11 implementado** — `POST /api/v1/auth/forgot-password` (Zod `forgotPasswordSchema` email-only `.strict()`, anti-enumeração 200 idêntico para e-mail existente/inexistente/suspenso/deletado, token 64 chars `VerificationToken type=PASSWORD_RESET` 1h, envio via `sendPasswordResetEmail`, rate limit 429 `AUTH_FORGOT_RATE_LIMIT` — máx. 3/hora por e-mail **e** 5/hora por IP (`MAX_PASSWORD_RESET_IP_ATTEMPTS`, checagem+registro do IP **antes** do lookup do usuário) — contagem por e-mail registrada antes da verificação de existência, anti-spam); **T12 implementado** — `POST /api/v1/auth/reset-password` (Zod `resetPasswordSchema` `{ token, password, passwordConfirmation }` `.strict()`, hash bcrypt custo 12, token single-use, 401 `AUTH_RESET_TOKEN_INVALID` / 410 `AUTH_RESET_TOKEN_EXPIRED` (1h), invalida **todas** as sessões via `revokeAllSessions` + log de segurança `AUTH_PASSWORD_RESET`; **sem rate limit próprio** — a rota não usa `src/lib/rate-limit.ts` (protegida pelo token `PASSWORD_RESET` single-use de 1h; o limite 3/h + 5/h por IP é da emissão via forgot-password))
- **Rotas de rate limit de magic link** — Sprint 1: **T9 implementado** — `POST /api/v1/auth/magic-link` (Zod `magicLinkSchema` email-only `.strict()`, anti-enumeração 200 idêntico, token 64 chars `VerificationToken type=MAGIC_LINK` 15min, envio via `sendMagicLinkEmail`, rate limit 429 `AUTH_MAGIC_LINK_RATE_LIMIT` máx. 3/hora por e-mail e 3/hora por IP; **T10 verify implementado** — `POST /api/v1/auth/magic-link/verify` consome o token single-use, 401 `AUTH_MAGIC_TOKEN_INVALID` / 410 `AUTH_MAGIC_TOKEN_EXPIRED`; no sucesso também cunha o cookie de sessão do Auth.js via `mintAuthJsSessionCookie` — ADR-011)
- **Custom JWT Layer** — Sprint 1: access token (15 min, RS256) + refresh token rotativo (30 dias, cookie httpOnly `path=/api/v1/auth`) — **T9 implementado** (`POST /api/v1/auth/magic-link`), **T10 implementado** (`POST /api/v1/auth/magic-link/verify`), **T11 implementado** (`POST /api/v1/auth/forgot-password`), **T12 implementado** (`POST /api/v1/auth/reset-password`), **T13 implementado** (`POST /api/v1/auth/refresh`), **T14 implementado** (`POST /api/v1/auth/logout`), **T30 implementado** (`POST /api/v1/auth/verify-email` + `POST /api/v1/auth/verify-email/resend`)
- **Exclusão de conta (LGPD)** — Sprint 1: **T15 implementado** — `DELETE /api/v1/auth/account` (soft delete **atômico** via `softDeleteAccount` numa única transação: `isActive=false` + `deletedAt` + revogação de todas as `Session` + bump de `tokenVersion`, janela de restauração de 30 dias, confirmação digitada do e-mail, anti-enumeração 200 idêntico, e-mail de confirmação best-effort via `sendAccountDeletionEmail`); **T16 implementado** — `GET /api/cron/hard-delete` job agendado (Vercel Cron 03:00 UTC, `src/jobs/hard-delete-accounts.ts`): anonimiza contas com `deletedAt` > 30 dias e `isActive: false` (email/providerId → `@deleted.local` digest, name → `"Usuario Removido"`, campos sensíveis → null, bump de `tokenVersion`, deleta session/userProfile/subscription e purga `VerificationToken` numa transação callback-style com claim-guard — conta restaurada entre seleção e execução é pulada; e-mail final best-effort via `sendAccountDeletedFinalEmail` **após o commit**, protegido por `CRON_SECRET`); **T17 implementado** — `POST /api/v1/auth/restore-account` (`src/app/api/v1/auth/restore-account/route.ts`): restauração **não autenticada** (conta deletada não consegue se autenticar) com **prova de posse e-mail + senha** (bcrypt), somente dentro da janela de 30 dias (`deletedAt`), transação callback-style com **claim idempotente** (`updateMany` revalida `{ id, email, isActive: false, deletedAt }` — restauração/anonimização concorrente → no-op 200 idêntico), aplica `isActive: true` + `deletedAt: null` + bump de `tokenVersion` + espelho Redis, **anti-enumeração 200 idêntico** em qualquer no-op (240–400 ms), 400 `AUTH_RESTORE_WINDOW_EXPIRED` somente após prova de posse fora da janela, log de segurança `AUTH_ACCOUNT_RESTORED`
- **Sessões ativas** — Sprint 1: visualização e revogação de dispositivos conectados
- **Guard de ambiente do Auth.js (`src/auth/auth.config.ts`)** — em produção (`NODE_ENV === "production"` e `NEXT_PHASE !== "phase-production-build"`), o módulo **falha rápido no load** se `AUTH_URL` ausente ou sem `https://`, ou se `AUTH_SECRET` ausente (erros carregam apenas diagnósticos de presença/scheme/`VERCEL_ENV` — **nunca valores de segredo**); `NEXT_PHASE=phase-production-build` isenta o guard para builds; coberto por `tests/auth-config.test.ts`

---

## Configuração do Google OAuth (credenciais)

O login via Google OAuth (MVP, ADR-010) requer um **OAuth 2.0 Client** no Google Cloud Console. O provider é **condicional**: só é registrado em `src/auth/auth.config.ts` quando as duas vars `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` estão definidas (sem elas, o magic link segue funcional).

### Criar as credenciais (Google Cloud Console)

1. Acesse [Google Cloud Console](https://console.cloud.google.com/) e selecione (ou crie) um projeto.
2. Navegue para **APIs & Services → OAuth consent screen** (`https://console.cloud.google.com/apis/credentials/consent`):
   - Escolha **External** (aplicação de teste / produção requer verificação publicada).
   - Preencha app name e e-mail de suporte; salve.
3. Navegue para **APIs & Services → Credentials → Create credentials → OAuth client ID** (`https://console.cloud.google.com/apis/credentials`):
   - Application type: **Web application**.
   - **Authorized redirect URIs**: adicione a URL de callback do Auth.js:
     - Local dev: `http://localhost:3000/api/auth/callback/google`
     - Produção: `https://SEU-DOMINIO/api/auth/callback/google` (substitua `SEU-DOMINIO`)
   - **Authorized JavaScript origins** (opcional, se necessário): origem da aplicação (ex.: `http://localhost:3000`).
   - Clique em **Create**.
4. Copie o **Client ID** e o **Client Secret** exibidos.

### Configurar as variáveis de ambiente

Use a convenção `AUTH_GOOGLE_*` (não `GOOGLE_CLIENT_*`):

- `AUTH_GOOGLE_ID` — o **Client ID** (termine com `.apps.googleusercontent.com`).
- `AUTH_GOOGLE_SECRET` — o **Client Secret**.

Preencha em `.env` (dev local) e nas variáveis de ambiente de produção/staging (nunca no `.env.example`, que só tem nomes, nem em `.env.local`). A URL de callback é derivada por `AUTH_URL`/`AUTH_TRUST_HOST` no Auth.js v5 — não é obrigatório definir `GOOGLE_CALLBACK_URL` explicitamente.

---

## Sincronização de perfil Google (`events.signIn` — fix 2026-09-25)

Bug: contas criadas via Google OAuth ficavam sem nome e sem avatar, porque o adapter mínimo
(`getUserByAccount`/`createUser`) não copia `profile.name`/`profile.picture` para `User`. O usuário
via Google precisava preencher tudo à mão — e o Arcano Pessoal nem podia ser calculado, já que
`calculatePersonalArcana` exige `User.name` **e** `User.birthDate`.

`src/auth/auth.config.ts` agora tem um bloco `events.signIn` (Auth.js v5) que roda **após** o login
bem-sucedido, exclusivo para `account.provider === "google"`.

### Regras (todas não destrutivas)

Lê o estado atual com `prisma.user.findUnique({ select: { name, displayName, avatar } })` e só
preenche campos **vazios**:

| Campo de `User` | Origem | Condição de escrita |
|---|---|---|
| `name` | `profile.name` (trim) | só se `current.name` estiver vazio |
| `displayName` | mesmo valor de `name` (trim) | só se `current.displayName` estiver vazio |
| `avatar` | `profile.picture` (trim) | só se `current.avatar` estiver vazio |

- **Nunca sobrescreve** valor já existente — trocar o nome/avatar que o usuário editou no perfil é
  proibido. O data object é montado campo a campo e, se ficar vazio, o `update` nem é executado
  (`Object.keys(data).length === 0` → early return).
- Valores vazios/brancos no `profile` caem no valor atual (fallback `|| current.<campo>`), evitando
  gravar `""`.
- Sucesso → `logger.info("[auth:signin] perfil enriquecido com dados do Google")`.

### Falha não derruba o login

O handler inteiro é envolvido em `try/catch`: qualquer erro (falha de rede no Prisma, coluna
inexistente, etc.) gera apenas
`logger.warn("[auth:signin] falha ao enriquecer perfil Google")` e **não faz `throw`**. Um `throw`
aqui abortaria a criação da sessão após a autenticação ter sido bem-sucedida. `events` do Auth.js é
executado **após** o login; falhar aqui não pode custar o login ao usuário.

### Limitação conhecida: `birthDate` NÃO vem do Google

O Google **não expõe data de nascimento no escopo `openid email profile`** (o `id_token` carrega
apenas `sub`, `name`, `given_name`, `family_name`, `picture`, `email`, `email_verified`). Logo:

- `events.signIn` **não** popula `User.birthDate` — nenhum outro campo derivado (`astrologicalSign`,
  `mayanKin`, `personalArcana`) é preenchido no signIn.
- O usuário **precisa informar a data de nascimento manualmente** (em `/perfil/editar`) para desbloquear
  signo, kin e Arcano Pessoal.
- Obter a data exigiria a **Google People API** com escopo adicional (`https://www.googleapis.com/auth/contacts.readonly`
  + consentimento explícito do usuário), o que está **fora do escopo do MVP** e exigiria novo ADR +
  tela de autorização. Não documentar sync de `birthDate` como implementado.

> ⚠️ **Sem cobertura de teste.** O bloco `events.signIn` **não** é exercitado por
> `tests/auth-config.test.ts` (que só cobre o env guard e o contrato dos providers) nem por qualquer
> outro arquivo em `tests/`. Ao mexer neste handler, adicionar casos para: (a) preenche `name`/
> `displayName`/`avatar` quando vazios; (b) **não** sobrescreve valores já preenchidos; (c) falha de
> Prisma é engolida e **não** propaga; (d) provider diferente de `google` é ignorado.

---

## Fluxo Principal (MVP)

1. O usuário acessa `/login` — o `LoginForm` (T19) oferece **e-mail + senha** como fluxo principal, com alternativas **Entrar com Google** e **Entrar com magic link**
2. **E-mail + senha**: validação client-side (react-hook-form + `zodResolver(loginSchema)`); `useAuthStore.login(email, password)` garante o cookie CSRF via `ensureCsrfCookie()` (`csrf-token`/`__Host-csrf-token`) e chama `POST /api/v1/auth/login` enviando o header `x-csrf-token` (double-submit — 403 `CSRF_TOKEN_INVALID` sem ele); sucesso → `router.push(callbackUrl)` (callback seguro `?callbackUrl=`, default `/dashboard`) + `router.refresh()`; se já autenticado, efeito de mount chama `refreshSession()` e só redireciona via `router.replace(callbackUrl)` quando a ida ao servidor retornar `ok` (sem redirect por confiança client-side); `AUTH_EMAIL_NOT_VERIFIED` → `/verify-email?email=...`; demais erros mapeados para mensagens amigáveis; Google → `signIn("google", { callbackUrl })` com o mesmo callback validado
3. **Magic link**: o usuário acessa `/magic-link` — o `MagicLinkForm` (T21) oferece campo único de e-mail com validação client-side (react-hook-form + `zodResolver(magicLinkSchema)`), mensagem informativa "Enviamos um link de acesso para seu email", feedback visual animado (ícone de envelope pulsante + "Verifique sua caixa de entrada") e timer de reenvio de 60s; `useAuthStore.sendMagicLink(email)` chama `POST /api/v1/auth/magic-link`; sucesso exibe feedback visual; erros `AUTH_MAGIC_LINK_RATE_LIMIT` e falha de rede mapeados para mensagens amigáveis
4. **Magic link (Auth.js)**: o `EmailProvider` do Auth.js gera o token em `VerificationToken` e envia o link (15 min, single-use; em dev, `AUTH_EMAIL_SKIP_SEND=true` loga o link no console)
5. O clique no link autentica no callback `/api/auth/callback/email` (o token é deletado na redenção — single-use)
6. **Google OAuth**: o Auth.js redireciona para o consent screen; no callback `/api/auth/callback/google`, o adapter mínimo busca/cria o usuário (`getUserByAccount`/`getUserByEmail`/`createUser` + `linkAccount`) e o `events.signIn` de `src/auth/auth.config.ts` **enriquece o perfil de forma não destrutiva** (ver §Sincronização de perfil Google abaixo)
7. A sessão é o **cookie JWT do Auth.js** (JWT strategy) — o Auth.js não grava sessões no banco
8. Rotas protegidas (`/dashboard/:path*`) são validadas em três camadas: (1) `src/proxy.ts` via `getToken({ secret: AUTH_SECRET })` (sem sessão → redirect `/login?callbackUrl=<pathname>`), (2) em nível de route group pelo guard `src/app/(app)/layout.tsx` (`auth()` + `redirect("/login")` — F2B) e (3) `AuthGuard` client-side (`src/components/auth/auth-guard.tsx`, T24) que valida a sessão pós-montagem via `refreshSession()` do auth-store; sem sessão válida (ou role mismatch), `router.replace("/login")`
9. **Sprint 1**: a Custom JWT Layer assume após o callback (callbacks `jwt`/`session` em `src/auth/auth.config.ts`): access token (15 min, RS256) + refresh token rotativo (30 dias)
10. **Sprint 1**: rate limit de magic link (3/hora — T9 implementado), recuperação de senha (1h — T11 implementado) e exclusão de conta (LGPD, 30 dias — T15 soft delete implementado + T16 hard-delete cron implementado)
11. **Recuperação de senha**: o usuário acessa `/forgot-password` — o `ForgotPasswordForm` (T22) oferece campo único de e-mail (react-hook-form + `zodResolver(forgotPasswordSchema)`); `useAuthStore.forgotPassword(email)` chama `POST /api/v1/auth/forgot-password`; sucesso substitui o formulário por painel `role="status"` com a mensagem da API ("Se o e-mail estiver cadastrado, voce recebera instrucoes...") + link "Voltar ao login"; erros `AUTH_FORGOT_RATE_LIMIT`/rede mapeados para mensagens amigáveis; o token `PASSWORD_RESET` (1h) é redimido por `POST /api/v1/auth/reset-password` (T12); o `ResetPasswordForm` (T23) em `/reset-password` recebe o token de `?token=...`, valida as senhas com `resetPasswordFormSchema` (mesmas regras do cadastro), mapeia erro para token invalido/expirado e, em sucesso, exibe painel `role="status"` com a mensagem da API e redireciona para `/login` via `router.replace` após 2s

---

## Cadastro por e-mail e senha (`POST /api/v1/auth/register`) — T6 implementado

Primeira rota da **Custom JWT Layer** (Fase 2) implementada em
`src/app/api/v1/auth/register/route.ts`. Contrato canônico conforme o plano S11 (design §3),
que supersede a divergência antiga da `docs/04-api/authentication.md` (sem `birthDate`/idade,
sem auto-login).

### Contrato do endpoint

- **Body** `{ name, email, password, passwordConfirmation, acceptTerms }` — **sem `birthDate`**
- **CSRF** — double-submit obrigatório (cookie `csrf-token`/`__Host-csrf-token` definido **client-side** por `ensureCsrfCookie()` (`src/lib/csrf-client.ts`) em `register()` do store imediatamente antes do POST — mount `useEffect` do `RegisterForm` removido por ser redundante; nome/token do cookie centralizados em `src/lib/csrf-cookie-name.ts`, comparação server-side via `timingSafeEqual` por byte-length —, vs header `x-csrf-token`); 403 `CSRF_TOKEN_INVALID` em falha — `cookies().set()` em Server Component é ilegal no App Router do Next 16
- **201** → `{ message }` **apenas** (anti-enumeração: resposta idêntica para e-mail novo ou já cadastrado — **sem objeto `user`**, sem `accessToken`/`meta`; o cadastro **NÃO faz auto-login** e exige verificação de e-mail — RF-AUTH-005). Cliente (`auth-store.register`) aceita sucesso quando `res.ok` e o body tem `message`
- **403** `CSRF_TOKEN_INVALID` — token CSRF ausente/divergente (double-submit)
- **422** `VALIDATION_ERROR` — falha de validação Zod (com `details` por campo)
- **429** `AUTH_RATE_LIMITED` — limite por e-mail ou IP (`retryAfter` + header `Retry-After`)
- **500** `INTERNAL_ERROR` — falha interna ao criar conta
- **Não há 409** no contrato atual (duplicado retorna o mesmo 201 message-only)

### Validação (Zod)

Schemas compartilhados em **`src/lib/validators/auth.ts`** (local canônico para validação de
register/senha das rotas `/api/v1/auth/*`):

- `passwordSchema` — min 8 chars + 1 maiúscula + 1 minúscula + 1 número + 1 especial
- `registerSchema` — `name` 2–50, `email` RFC, `password` (via `passwordSchema`),
  `passwordConfirmation` idêntico, `acceptTerms === true`
- `RegisterInput` — tipo inferido (`z.infer<typeof registerSchema>`)

### Comportamento

1. Valida o body com `registerSchema` (422 `VALIDATION_ERROR` em falha)
2. Normaliza `email` para minúsculas; busca duplicado case-insensitive — se existir, **não** cria conta e ainda assim retorna o mesmo 201 `{ message }` (anti-enumeração; piso de timing `equalizeNoopTiming()` 240–400ms para igualar ao caminho com bcrypt+transação; log `[auth:register] email ja cadastrado`)
3. Hash da senha com **bcrypt custo 12** (`BCRYPT_COST = 12`) — nunca plaintext
4. Cria `User` com `role=USER`, `plan=FREE`, `provider=EMAIL`, `providerId=email-lowercase`
   (convenção S7), `displayName=name`
5. Cria `VerificationToken` `type=EMAIL` com validade de **24h**
6. Envia e-mail de verificação apontando para o frontend `/verify-email?token=...`
   (helper `sendVerificationEmail` de `src/lib/email/email.ts`)
7. Retorna **201** `{ message }` **apenas** (anti-enumeração — sem objeto `user` no body)

### Observability

Respostas de erro usam o envelope `{ error: { code, message, details? } }` com correlação
`requestId`/`newReqId()` e log estruturado Pino (`src/lib/logger.ts`) em cada etapa
(`[auth:register] ...`).

### Testes

`tests/register.test.ts` — 10 testes vitest cobrindo o contrato do register (validação,
duplicado, hash, criação de token de verificação, resposta **201 message-only uniforme**
(sem 409 — anti-enumeração), erros 422/429/CSRF).

---

## Login por e-mail e senha (`POST /api/v1/auth/login`) — T7 implementado

Segunda rota da **Custom JWT Layer** (Fase 2) implementada em
`src/app/api/v1/auth/login/route.ts`. Contrato canônico conforme o plano S11 (design §3).

### Contrato do endpoint

- **Body** `{ email, password }` — validado com `loginSchema` de `src/lib/validators/auth.ts`
- **CSRF (2026-09-18; cookie client-side 2026-09-23; store authoritative 2026-09-24)** — double-submit obrigatório: cookie `csrf-token`/`__Host-csrf-token` (definido **client-side** por `ensureCsrfCookie()` (`src/lib/csrf-client.ts`) em `login()` do store imediatamente antes do POST — mount `useEffect` do `LoginForm` removido por ser redundante; nome/token centralizados em `src/lib/csrf-cookie-name.ts`; comparação via `timingSafeEqual` por byte-length — não em Server Component) vs header `x-csrf-token` (enviado pelo `login()` do store); validado logo após o body, antes de qualquer efeito colateral
- **200** → `{ accessToken, user: { id, name, email, displayName, role, plan, avatar } }`
  — **body plano (flat), sem wrapper `data`** + `Set-Cookie: refreshToken`
  (`Path=/api/v1/auth`, `HttpOnly`, `SameSite=Strict`, `Max-Age=2592000` = 30 dias)
  + `Set-Cookie` do cookie de sessão do Auth.js (ADR-011): `authjs.session-token` (HTTP) /
  `__Secure-authjs.session-token` (HTTPS), `Path=/`, `HttpOnly`, `SameSite=Lax`,
  `Max-Age=2592000` (30 dias), `Secure` em HTTPS — payload `{ sub, userId, customAuth }`
  via `encode` de `next-auth/jwt`; exige `AUTH_SECRET` (lança erro claro se ausente)
- **422** `VALIDATION_ERROR` — falha de validação Zod (com `details` por campo)
- **403** `CSRF_TOKEN_INVALID` — token CSRF ausente/divergente (double-submit)
- **403** `AUTH_ACCOUNT_LOCKED` — 5 falhas consecutivas (body com `retryAfter: 900`)
- **429** `AUTH_RATE_LIMITED` — limite de volume por IP (5/15min; body com `retryAfter`)
- **403** `AUTH_ACCOUNT_SUSPENDED` — `isActive=false` ou `deletedAt` set
- **401** `AUTH_EMAIL_NOT_VERIFIED` — e-mail não verificado
- **401** `AUTH_INVALID_CREDENTIALS` — credenciais incorretas (anti-enumeração)

### Serviços de suporte (implementados)

- **`src/services/token-service.ts`** — `signAccessToken` (RS256 via jose, 15min,
  claims `role`/`plan`/`tokenVersion`), `verifyAccessToken` (fail-closed, Redis cache com
  fallback DB, admin recheck de `isActive`/`deletedAt`), `createRefreshSession` (Session 30d),
  `rotateRefresh` (rotação + revogação de família em reuso), `bumpTokenVersion` (incremento
  atômico), `revokeRefreshSession` (revoga Session por hash; idempotente), `revokeAllSessions`
  (revoga todas as Session + bump de `tokenVersion`), `AuthTokenError`
- **`src/lib/rate-limit.ts`** — rate limiting em memória: lockout de conta (5 falhas
  consecutivas → 15min, `retryAfter`) e limite de volume por IP (5/15min → 429),
  `resetRateLimiter()`
- **`src/lib/redis.ts`** — singleton Redis (ioredis, `lazyConnect`, gated on `REDIS_URL` env)

### Testes

`tests/login.test.ts` — 15 testes vitest cobrindo o contrato do login (validação, lockout,
rate limit, suspensão, email não verificado, credenciais inválidas, sucesso com accessToken
+ refresh cookie) e a ponte de sessão Auth.js (ADR-011: emissão/decode do cookie de sessão,
variante `__Secure-` em HTTPS, ausência de cookie em credenciais inválidas, erro claro sem
`AUTH_SECRET`). `tests/auth-store.test.ts` — 81 testes vitest do AuthStore (login: sucesso,
credenciais inválidas, email não verificado guarda user parcial (C9), código desconhecido, falha de rede, resposta
não-JSON; register: sucesso sem auto-login, email já cadastrado, falha de rede, resposta
não-JSON; sendMagicLink: sucesso sem autenticar, rate limit com `retryAfter`, e-mail vazio →
`VALIDATION_ERROR` sem fetch, código desconhecido normalizado para `UNKNOWN_ERROR`, falha de
rede → `NETWORK_ERROR`, resposta não-JSON; forgotPassword: e-mail vazio → `VALIDATION_ERROR`
sem fetch, sucesso com mensagem, sucesso com qualquer 200 + `message` (sem depender do texto),
rate limit (sem `retryAfter`), código desconhecido normalizado para `UNKNOWN_ERROR`, falha de
rede → `NETWORK_ERROR`, resposta não-JSON; resetPassword: sucesso enviando token+senha, sucesso
com qualquer 200 + `message`, token inválido (401) → `AUTH_RESET_TOKEN_INVALID`, token expirado
(410) → `AUTH_RESET_TOKEN_EXPIRED`, validação (422) → `VALIDATION_ERROR`, código desconhecido
normalizado para `UNKNOWN_ERROR`, falha de rede → `NETWORK_ERROR`, resposta não-JSON →
`UNEXPECTED_RESPONSE`, token vazio → `AUTH_RESET_TOKEN_INVALID` sem fetch; refreshSession:
sucesso mantém auth, refresh sem user não autentica (isAuthenticated derivado de user), 401/403 falha+limpa, 200 sem accessToken
falha, não-JSON (500 preserva a sessão / 400 limpa), network TypeError falha; persist: login persiste user no localStorage, rehydrate deriva isAuthenticated, PartialUser reidratado não autentica, dado corrompido/malformado é descartado (fail closed), role fora do union (adulterado) e shape parcial com role descartados (`isStoredUser` valida `id`/`name`/`displayName`/`role ∈ {USER,PROFESSIONAL,ADMIN}`/`plan`/`avatar`); `emailVerified` ausente no payload deriva `true`, presente `null` deriva `false`; error auto-limpa após 5s sem reiniciar o timer quando o erro permanece inalterado (só em transição null→não-null/valor novo); loginWithGoogle: signIn google com callbackUrl do parametro (default `/dashboard`), seta `isLoading` e NEXT_REDIRECT ignorado, demais falhas setam erro; logout: POST /auth/logout com Bearer e limpa estado (com/sem sessão, falha de rede, falha do `signOut`), sempre chama signOut({ redirect: false }) best-effort, limpa cache de access token/session + `resetAuthApiSessionCache()` + `resetUser()` (PostHog) e deleta Cache Storage `arkana-agora-*`; deleteAccount: DELETE /auth/account com Bearer + { email: email.trim().toLowerCase() }, HTTP não-ok mantém estado e registra erro, falha de rede mantém estado e registra erro, falha do `signOut` após `res.ok` não impede a limpeza; `clearError`).
`tests/auth-guard.test.tsx` — 7 testes vitest do AuthGuard (valida a sessão persistida via
`refreshSession()` antes de renderizar e mostra skeleton no primeiro render, bloqueia role
mismatch e redireciona /login, renderiza quando role bate, skeleton enquanto verifica + chama
refreshSession, renderiza após refresh ok, redireciona /login quando refresh falha, redireciona
/login quando refresh ok mas role não bate (user null), não chama refreshSession duas vezes).
`tests/magic-link-form.test.tsx` — 17 testes vitest do MagicLinkForm (renderização, validação
client-side, submissão com loading/sucesso/erros mapeados, cooldown de reenvio de 60s com fake
timers). `tests/forgot-password-form.test.tsx` — 10 testes vitest do ForgotPasswordForm
(renderização, validação client-side, submissão com loading/sucesso/erros mapeados).
`tests/reset-password-form.test.tsx` — 13 testes vitest do ResetPasswordForm (renderização dos
campos com `autoComplete="new-password"`, painel de token inválido sem chamada de API, validação
client-side sem chamada de API, submissão com loading/sucesso/erros mapeados, redirect para
`/login` após 2s).

---

## Refresh de token (`POST /api/v1/auth/refresh`) — T13 implementado

Terceira rota da **Custom JWT Layer** (Fase 2) implementada em
`src/app/api/v1/auth/refresh/route.ts`.

### Contrato do endpoint

- **Cookie** `refreshToken` (httpOnly, `path=/api/v1/auth`) — nunca em body/query
- **200** → `{ accessToken, expiresIn }` + `Set-Cookie` do refresh rotacionado (mesmo `familyId`)
- **401** `AUTH_REFRESH_TOKEN_INVALID` / `AUTH_REFRESH_TOKEN_EXPIRED` / `AUTH_REFRESH_TOKEN_REVOKED`
- **403** `AUTH_ACCOUNT_SUSPENDED` — conta suspensa (`isActive=false`/`deletedAt`)
- **500** `INTERNAL_ERROR` — erro desconhecido
- Todos os erros incluem `meta.requestId` (C13)

### Comportamento

1. Lê o `refreshToken` do cookie httpOnly
2. Chama `rotateRefresh` de `src/services/token-service.ts` (rotação condicional anti-race +
   revogação de família em reuso)
3. Sucesso: retorna `200 { accessToken, expiresIn }` + `Set-Cookie` do refresh rotacionado
4. Mapeia `AuthTokenError` para HTTP (401/403/500 conforme o código)
5. Log estruturado não expõe o token

### Testes

`tests/refresh.test.ts` — 8 testes vitest cobrindo o contrato do refresh (rotação, reuso,
expiração, invalidação, suspensão, sucesso com accessToken + Set-Cookie).

---

## Logout (`POST /api/v1/auth/logout`) — T14 implementado

Quarta rota da **Custom JWT Layer** (Fase 2) implementada em
`src/app/api/v1/auth/logout/route.ts`.

### Contrato do endpoint

- **Header** `Authorization: Bearer <accessToken>` (obrigatório) — verificado via
  `verifyAccessToken` de `src/services/token-service.ts`
- **Cookie** `refreshToken` (httpOnly, `path=/api/v1/auth`) — lido para revogação single-device
- **Body (opcional)** `{ allDevices?: boolean }` — `true` revoga todas as sessões do usuário
- **200** → `{ message }` — **body plano (flat), sem wrapper `data`** (consistente com
  login/register/refresh) + `Set-Cookie` limpando o refresh (`Max-Age=0`) + `Cache-Control: no-store`
- **401** `AUTH_TOKEN_INVALID` / `AUTH_TOKEN_REVOKED` — access token ausente/inválido/revogado
- **403** `AUTH_ACCOUNT_SUSPENDED` — conta suspensa (`isActive=false`/`deletedAt`)
- **500** `INTERNAL_ERROR` — erro desconhecido (código `AuthTokenError` não vazado)
- Todos os erros incluem `meta.requestId` (C13)

### Comportamento

1. Lê o access token do header `Authorization: Bearer`; ausente → 401 `AUTH_TOKEN_INVALID`
2. Verifica via `verifyAccessToken`; mapeia `AuthTokenError` (403 suspensão / 401 `AUTH_TOKEN_*` /
   500 código desconhecido)
3. Lê o body opcional `{ allDevices }` (não-booleano/ausente → `false`)
4. **Default:** chama `revokeRefreshSession(rawToken)` com o refresh do cookie (idempotente)
5. **`allDevices=true`:** chama `revokeAllSessions(userId)` — revoga todas as `Session` +
   **bump de `tokenVersion`** (contrato de segurança architecture-review: invalida todos os
   access tokens emitidos)
6. Sempre limpa o cookie de refresh (`Max-Age=0`) e retorna `200 { message }`
7. Log estruturado não expõe tokens (C13)

### Serviços de suporte (implementados)

- **`src/services/token-service.ts`** — adiciona `revokeRefreshSession(rawToken)` (revoga a
  `Session` pelo hash do token; idempotente) e `revokeAllSessions(userId)` (revoga todas as
  `Session` + `bumpTokenVersion`). A rota **nunca duplica** lógica de rotação/revogação — delega
  tudo ao serviço compartilhado (S10).

### Testes

`tests/logout.test.ts` — 9 testes vitest cobrindo o contrato do logout (revogação single-device,
idempotência sem refresh cookie, `allDevices=true`, `allDevices` não-booleano, 401/403/500,
não exposição de tokens). `tests/token-service.test.ts` — 4 testes adicionais para
`revokeRefreshSession`/`revokeAllSessions`.

---

## Redefinição de senha (`POST /api/v1/auth/reset-password`) — T12 implementado

Rota que redime o token `PASSWORD_RESET` emitido pelo forgot-password (T11), implementada em
`src/app/api/v1/auth/reset-password/route.ts`.

### Contrato do endpoint

- **Body** `{ token, password, passwordConfirmation }` — validado com `resetPasswordSchema` de
  `src/lib/validators/auth.ts` (`.strict()`, reusa `passwordSchema` do register)
- **200** → `{ message: "Senha redefinida com sucesso" }` — **body plano (flat), sem wrapper
  `data`** (consistente com as demais rotas)
- **422** `VALIDATION_ERROR` — body inválido, campo extra, senha fraca ou `passwordConfirmation`
  divergente (com `details` por campo); corpo não-JSON → 422
- **401** `AUTH_RESET_TOKEN_INVALID` — token inexistente, tipo ≠ `PASSWORD_RESET`, já usado
  (single-use) ou usuário inativo/deletado (janela LGPD — **nunca reativa conta via token válido**)
- **410** `AUTH_RESET_TOKEN_EXPIRED` — token expirado (1h); deletado no momento da detecção
- **500** `INTERNAL_ERROR` — falha interna (inclui `meta.requestId`, C13)
- **Rate limit** nesta rota: 3/h por email (via `src/lib/rate-limit.ts`, T27 implementado)

### Comportamento

1. Valida o body com `resetPasswordSchema` (422 `VALIDATION_ERROR` em falha)
2. Busca o `VerificationToken` por `token`; inexistente ou `type ≠ PASSWORD_RESET` → 401
3. Token expirado (1h) → deleta o token e retorna 410 `AUTH_RESET_TOKEN_EXPIRED`
4. Revalida o usuário (`isActive=true AND deletedAt=null` via `identifier` do token) —
   inativo/deletado → 401 e token consumido
5. Redime o token **single-use** (delete atômico via `deleteMany` com `expiresAt > now` —
   contagem ≠ 1 = já usado → 401)
6. Hash da nova senha com **bcrypt custo 12** (`BCRYPT_COST = 12`) e atualiza `passwordHash`
7. `revokeAllSessions(userId)` — invalida **todas** as sessões (bump de `tokenVersion` + espelho Redis)
8. Log de segurança `AUTH_PASSWORD_RESET` com IP/userAgent; retorna **200 `{ message }`**

**Consumo no frontend (T23):** o `ResetPasswordForm` (`src/app/(auth)/reset-password/reset-password-form.tsx`) consome este endpoint via `useAuthStore.resetPassword({ token, password, passwordConfirmation })`, validando as senhas client-side com `resetPasswordFormSchema` (mesmas regras do cadastro) e mapeando `AUTH_RESET_TOKEN_INVALID`/`AUTH_RESET_TOKEN_EXPIRED`/`VALIDATION_ERROR`/`NETWORK_ERROR`/`UNEXPECTED_RESPONSE`/`UNKNOWN_ERROR` para mensagens amigáveis; em sucesso exibe painel `role="status"` com a mensagem da API e redireciona para `/login` via `router.replace` após 2s.

### Testes

`tests/reset-password.test.ts` — 14 testes vitest cobrindo o contrato do reset-password
(validação, token inválido/tipo errado, expirado, single-use, usuário inativo/deletado LGPD,
hash bcrypt custo 12, revogação de sessões, 200 flat, 401/410/422/500).
`tests/reset-password-form.test.tsx` — 13 testes vitest do ResetPasswordForm (renderização,
painel de token inválido sem chamada de API, validação client-side, submissão com
loading/sucesso/erros mapeados, redirect para `/login` após 2s).

---

## Versão

| Feature | Versão |
|---|---|
| Login OAuth (Google) | MVP |
| Magic Link | MVP |
| Sessão JWT do Auth.js (`/api/auth/*`) | MVP |
| Proteção de rotas (`src/proxy.ts` + `src/app/(app)/layout.tsx` + `AuthGuard` T24) | MVP |
| AuthGuard (frontend, `src/components/auth/auth-guard.tsx`) | Sprint 1 — **T24 implementado** |
| Cadastro e-mail/senha (`POST /api/v1/auth/register`) | Sprint 1 — **T6 implementado** |
| Login e-mail/senha (`POST /api/v1/auth/login`) | Sprint 1 — **T7 implementado** |
| LoginForm (frontend, `src/app/(auth)/login/login-form.tsx`) | Sprint 1 — **T19 implementado** (2026-09-24: `callbackUrl` seguro same-origin + Suspense + redirect de sessão ativa via efeito de mount (só após `refreshSession()` retornar `ok`) + Google com mesmo `callbackUrl`) |
| LogoutButton (frontend, `src/components/auth/logout-button.tsx`) | **Implementado** — client logout no dashboard → `useAuthStore.logout()` (revoke + signOut + clear caches), não server action |
| RegisterForm (frontend, `src/app/(auth)/register/register-form.tsx`) | Sprint 1 — **T20 implementado** |
| MagicLinkForm (frontend, `src/app/(auth)/magic-link/magic-link-form.tsx`) | Sprint 1 — **T21 implementado** |
| ForgotPasswordForm (frontend, `src/app/(auth)/forgot-password/forgot-password-form.tsx`) | Sprint 1 — **T22 implementado** |
| ResetPasswordForm (frontend, `src/app/(auth)/reset-password/reset-password-form.tsx`) | Sprint 1 — **T23 implementado** |
| AuthStore (Zustand, `src/stores/auth-store.ts`) | Sprint 1 — **T25 implementado (F7); `login()`/`register()`/`sendMagicLink()`/`forgotPassword()`/`resetPassword()` endurecidos (try/catch/finally, parsing type-safe sem `as` casts via helper compartilhado `parseErrorResponse`, sucesso detectado estruturalmente — `res.ok && typeof data.message === "string"`, `MagicLinkResult`/`ForgotPasswordResult`/`ResetPasswordResult`/`VerifyEmailResult`/`VerifyMagicLinkResult` como uniões discriminadas sobre o genérico `AuthResult<TErrorCode>` — branch de falha `AuthFailureMessage<TErrorCode>` com `retryAfter?` em **todas** as categorias (via `hasMessage()`/`asAuthFailure()`; o 429 do forgot-password/magic-link agora carrega `retryAfter`), `User` com `emailVerified: boolean` (derivado de `emailVerified !== null` — S12) + `PartialUser` (C9: login 401 `AUTH_EMAIL_NOT_VERIFIED` guarda `{ email, emailVerified: false }`, `isAuthenticated=false`); `isAuthenticated` derivado de `user != null && user.emailVerified`; `refreshSession()` (T24) — delega a `refreshAccessTokenOnce()` de `src/lib/auth-refresh.ts` (single-flight com o interceptor axios); sucesso com `data.user` atualiza o user; sucesso só com `accessToken` **preserva** o user persistido e deriva `isAuthenticated` de `emailVerified`; `network_error` **não** desloga (error transitório); `auth_failed`/`bad_response` limpam o user; `server_error` (5xx) nao desloga (transitório, igual `network_error`); retorna boolean; persist middleware (chave `arkana-auth`, localStorage, `partialize` só `user`, `merge` valida a forma persistida via `isStoredUser` e deriva `isAuthenticated`, malformado → user null); error auto-clear 5s via timer no store; `loginWithGoogle()`/`logout()`/`deleteAccount(email)`; `logout`/`deleteAccount` (sucesso) chamam `signOut({ redirect: false })` do next-auth/react para invalidar a sessão Auth.js; `deleteAccount` só limpa estado se `res.ok`; `register` não faz auto-login; `sendMagicLink`/`forgotPassword`/`resetPassword` não autenticam** |
| Token interceptor (`src/lib/api.ts`) | Sprint 1 — **T26 implementado** — instância Axios com adapter custom (fetch), request interceptor adiciona `Authorization: Bearer <accessToken>` via `resolveAccessToken()` (cache TTL 60s + single-flight de `getSession()` — `src/lib/auth-refresh.ts`), response interceptor trata `401` → `refreshAccessTokenOnce()` (single-flight compartilhado), re-tenta o request original **uma** vez com `Authorization` fresco + `_retry` (sem re-ler a sessão); previne loop com flag `_retry`; `baseURL: "/api/v1"`, `adapter: fetchAdapter` (resolve URLs relativas via `window.location.origin` + `credentials: "include"`) |
| Refresh de token (`POST /api/v1/auth/refresh`) | Sprint 1 — **T13 implementado** |
| Logout (`POST /api/v1/auth/logout`) | Sprint 1 — **T14 implementado** |
| Login OAuth (Facebook) | Sprint 1 |
| Rotas de rate limit de magic link (`/api/v1/auth/magic-link`) | Sprint 1 — **T9 implementado** |
| Recuperação de senha (`POST /api/v1/auth/forgot-password`) | Sprint 1 — **T11 implementado** |
| Redefinição de senha (`POST /api/v1/auth/reset-password`) | Sprint 1 — **T12 implementado** |
| Custom JWT Layer (access/refresh) | Sprint 1 — **parcial (register/login/magic-link/magic-link-verify/forgot-password/reset-password/refresh/logout/verify-email/verify-email-resend implementados)** |
| Exclusão de conta (`DELETE /api/v1/auth/account`) | Sprint 1 — **T15 implementado** |
| Hard-delete anonimização (`GET /api/cron/hard-delete`) | Sprint 1 — **T16 implementado** |
| Restauração de conta (`POST /api/v1/auth/restore-account`) | Sprint 1 — **T17 implementado** |
| Verificação de e-mail | Sprint 1 — **T30 implementado** |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| `next-auth` (Auth.js v5) | Biblioteca | Camada de login (Google OAuth + magic link); `5.0.0-beta.32` pinado (ADR-010; ≥ beta.32 mitiga GHSA-8fpg-xm3f-6cx3) |
| `nodemailer` + `@types/nodemailer` | Biblioteca | Envio dos e-mails de magic link |
| Banco de dados | Infraestrutura | Tabelas `users`, `verification_tokens` (adapter mínimo; sem model `Account` no MVP) |
| Serviço de e-mail (SMTP) | Serviço externo | Envio de magic links (dev: `AUTH_EMAIL_SKIP_SEND=true` loga o link no console) |
| Google OAuth / Facebook Login | API externa | Autenticação social (Google: MVP; Facebook: Sprint 1) |
| `bcryptjs` + `@types/bcryptjs` | Biblioteca | Hash de senhas — e-mail/senha (Sprint 1; **instalado no F1/T1**) |
| `jose` | Biblioteca | JWT RS256 da Custom JWT Layer (Sprint 1; **instalado no F1/T1**) |
| `zustand` | Biblioteca | Store de auth do frontend (Sprint 1; **instalado no F1/T1**) |
| `ioredis` + `@types/ioredis` | Biblioteca | Redis: validação de `tokenVersion` + rate limiting (Sprint 1; **instalado no F1/T1**) |
| `axios` | Biblioteca | Interceptor de API com refresh token (Sprint 1; **instalado no F1/T1**) |
| `resend` | Biblioteca | Provedor de e-mail transacional (issue #3): `src/lib/email/email.ts` com helpers `sendVerificationEmail`/`sendPasswordResetEmail`/`sendMagicLinkEmail`/`sendAccountDeletionEmail`/`sendAccountDeletedFinalEmail` (**implementado no T3/T16**) — consumido pelas rotas REST `/api/v1/auth/*` da Sprint 1 |
| `zod` | Biblioteca | Validação de inputs das rotas `/api/v1/auth/*` (Sprint 1) |

---

## Critérios de Aceite

- **CA-01**: O login com magic link deve autenticar o usuário e o e-mail deve ser enviado em até 10 segundos (em dev, o link é logado no console via `AUTH_EMAIL_SKIP_SEND=true`)
- **CA-02**: O token do magic link deve ser single-use e expirar em 15 minutos; redenção de token já usado deve falhar
- **CA-03**: O login com Google OAuth deve criar ou vincular a conta sem duplicação (vínculo via `User.provider`/`providerId`, sem model `Account`)
- **CA-04**: A sessão do MVP é o cookie JWT do Auth.js (`/api/auth/*`); a Custom JWT Layer (access/refresh) é Sprint 1, ancorada nos callbacks `jwt`/`session` de `src/auth/auth.config.ts`
- **CA-05**: O rate limit de magic link (máx. 3/hora por e-mail) deve retornar 429 `AUTH_MAGIC_LINK_RATE_LIMIT` — Sprint 1 (`POST /api/v1/auth/magic-link`)
- **CA-06**: A exclusão de conta deve marcar o registro para exclusão em 30 dias (LGPD, soft delete `deletedAt`) com possibilidade de restauração — Sprint 1
- **CA-07**: Tentativas de login com credenciais inválidas devem ser limitadas a 5 por IP em 15 minutos (rate limiting) — Sprint 1 (e-mail/senha)
- **CA-08**: O rate limit de forgot-password (máx. 3/hora por e-mail) deve retornar 429 `AUTH_FORGOT_RATE_LIMIT` — Sprint 1 (`POST /api/v1/auth/forgot-password`)
- **CA-09**: O reset de senha (`POST /api/v1/auth/reset-password`) deve redefinir a senha com bcrypt custo 12, consumir o token `PASSWORD_RESET` (single-use, 1h), invalidar **todas** as sessões do usuário (`revokeAllSessions`) e retornar 401 `AUTH_RESET_TOKEN_INVALID` / 410 `AUTH_RESET_TOKEN_EXPIRED` — Sprint 1 (T12)
