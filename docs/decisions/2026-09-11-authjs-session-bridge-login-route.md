# ADR-011: Ponte de sessão Auth.js no login por credenciais (bridge no route)

### Status
**Aceito** ✅ — decisão complementar ao ADR-009 (Gate B) e ADR-010; não altera cláusulas existentes, apenas define como o fluxo de credenciais (`POST /api/v1/auth/login`, T7) estabelece a sessão que os guards do dashboard reconhecem.

### Contexto

O `LoginForm` (T19) autentica via `useAuthStore.login()` → `POST /api/v1/auth/login` (ADR-009 Gate B). A rota valida credenciais (bcrypt), emite `accessToken` RS256 e `refreshToken` rotativo, e retorna o `accessToken` no corpo (não persistido no cliente, decisão de segurança) com `refreshToken` em cookie `HttpOnly` escopado a `Path=/api/v1/auth`.

Os guards do dashboard, porém, reconhecem **apenas sessões do Auth.js v5** (ADR-010): `src/proxy.ts` usa `getToken({ secret: AUTH_SECRET })` (cookie de sessão JWT do Auth.js) e `src/app/(app)/layout.tsx` usa `auth()`. `src/auth/auth.config.ts` registra apenas providers Google e Email — **não há `CredentialsProvider`**. Como o login por credenciais não emite cookie de sessão do Auth.js, qualquer navegação a `/dashboard` após "Entrar" é redirecionada de volta ao `/login`: o fluxo não funciona ponta-a-ponta.

Ao mesmo tempo, o design mandata (§5) que o `AuthStore` chame `POST /api/v1/auth/login` diretamente e que o access token **não** seja persistido no cliente — então "trocar para `signIn("credentials")`" (option C) exigiria emenda de especificação, e "tornar os guards cientes da sessão custom" (option B) ampliaria a superfície dos guards e o escopo do cookie de refresh.

### Decisão

A rota `POST /api/v1/auth/login`, no caminho de sucesso, passa a **cunhar o cookie de sessão do Auth.js** para o usuário autenticado, replicando o que o callback `jwt` de `auth.config.ts` produziria:

1. **Codificação**: `encode` de `next-auth/jwt` com `AUTH_SECRET`, payload `{ sub: user.id, userId: user.id, customAuth: { accessToken, refreshToken: session.rawToken, emittedAt: Date.now() } }` — espelha fielmente o efeito do callback `jwt` (que seta `token.userId` via `user.id` e `token.customAuth` via `emitCustomTokens`). `refreshToken` e `accessToken` aqui são os já emitidos pela própria rota (evita dupla criação de sessão de refresh).
2. **Cookie**: mesmo nome do Auth.js v5 sob `JWT` strategy — `authjs.session-token` em HTTP, `__Secure-authjs.session-token` em HTTPS (mesma regra de `secureCookie` já usada por `proxy.ts`). Atributos espelhando o Auth.js: `Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=30d`, `Secure` quando HTTPS.
3. **Pré-requisito**: `AUTH_SECRET` passa a ser obrigatório também no caminho de credenciais (mesmo guard já existente em `auth.config.ts` e `proxy.ts`) — a rota lança erro claro se ausente, para nunca cunhar cookie com segredo vazio.
4. **Sem `CredentialsProvider`**: o provider de credenciais continua fora da camada Auth.js (ADR-010 §10); a decisão do design §5 permanece intacta.

### Consequências

**Positivas:**
- O fluxo de credenciais atravessa os guards do dashboard (`getToken`/`auth()`) com o **mesmo** mecanismo de sessão de Google OAuth e magic link (ADR-010) — três métodos de login, uma única leitura de sessão.
- T25 (persistência do AuthStore) e T26 (interceptor Axios) podem ler `session.accessToken` do cookie de sessão (comportamento já exposto pelo callback `session` para os outros fluxos), unificando o modelo de sessão.
- Nenhuma mudança no contrato da API (cabeçalho/corpo do T7 permanecem): a ponte é um efeito colateral do caminho de sucesso.

**Negativas / riscos:**
- Duplica **transitoriamente** a sessão: o refresh token vive tanto no cookie custom (`Path=/api/v1/auth`) quanto serializado dentro do cookie de sessão do Auth.js (`customAuth.refreshToken`). Ambos são `HttpOnly`; o cookie de sessão do Auth.js não é escopado por path (mitigação futura: rotação/revogação unificada — ver ADR-009 Gate C).
- Se `auth.config.ts` evoluir o formato do token/callback `jwt` (novas claims), a ponte da rota precisa ser atualizada em conjunto — acoplamento pontual entre a rota e o `jwt` callback; documentado para revisão no T25/T26.
- A sessão cunhada não sofre os callbacks (`jwt`/`session`) do Auth.js em emissão — o payload é construído diretamente. Mantido idêntico ao que o callback produziria para `user.id` presente, minimizando divergência.

### Alternativas Consideradas

| Alternativa | Por que não escolhida |
|---|---|
| **Option B** — guards dual-aware (validar refresh cookie custom no `proxy.ts`/`(app)/layout.tsx`) | Amplia a superfície de cada guard, exige cookie de refresh sem escopo de path (menos defensivo) ou endpoint extra de validação de sessão a cada navegação |
| **Option C** — `CredentialsProvider` + `signIn("credentials")` no `LoginForm` | Contraria o design §5 (AuthStore chama `POST /api/v1/auth/login` diretamente; access token não persistido) e exigiria emenda de especificação; duplicaria a validação de credenciais entre provider e rota |
| **Option D** — documentar como débito e não entregar o fluxo funcional | O fluxo de credenciais ficaria não-funcional ponta-a-ponta (guard bounce), mantendo a regressão descoberta na revisão do T19 |

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*