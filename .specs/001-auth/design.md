# SPEC-001: Sistema de Autenticacao e Autorizacao -- Design Tecnico

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## 1. Componentes de Interface

### 1.1 AuthLayout
- Layout compartilhado para todas as paginas de autenticacao
- Divisao 50/50: lado esquerdo com formulario, lado direito com imagem decorativa tematica (tarot/misterio)
- Responsivo: em mobile, exibe apenas o formulario com background sutil
- Animacao de entrada com Framer Motion (fade + slide up, 300ms)

### 1.2 LoginForm
- Campos: email (type=email), senha (type=password com toggle de visibilidade)
- Validacao client-side com Zod: email valido, senha nao vazia
- Botao "Entrar" com estado de loading (spinner)
- Link "Esqueci minha senha" abaixo do formulario
- Link "Entrar com Google" (botao secundario com icone do Google)
- Link "Entrar com magic link" (texto)
- Link "Criar conta" no rodape
- Mensagens de erro exibidas inline abaixo de cada campo

### 1.3 RegisterForm
- Campos: nome de exibicao, email, senha, confirmar senha
- Indicador de forca de senha em tempo real (barra progressiva: fraca/media/forte)
- Checkbox obrigatorio: "Aceito os Termos de Uso e a Politica de Privacidade"
- Mesmo padrao visual e de animacao do LoginForm

### 1.4 MagicLinkForm
- Campo unico: email
- Mensagem informativa: "Enviaremos um link de acesso para seu email"
- Feedback visual apos envio: icone de envelope animado com texto "Verifique sua caixa de entrada"
- Timer de reenvio (60 segundos)

### 1.5 ForgotPasswordForm
- Campo unico: email
- Botao "Enviar link de recuperacao"
- Feedback de sucesso com instrucoes
- Link de retorno ao login

### 1.6 ResetPasswordForm
- Campos: nova senha, confirmar nova senha
- Validacao identica ao cadastro
- Token extraido da URL (query param `?token=...`)
- Mensagem de erro para token invalido/expirado
- Redirecionamento automatico para login apos sucesso (delay 2s)

### 1.7 AuthGuard
- Componente de rota protegida (wrapper)
- Verifica existencia e validade do access token
- Se nao autenticado: redireciona para /login
- Se access token expirou: tenta renovar com refresh token
- Se refresh token tambem expirou: redireciona para /login
- Exibe skeleton loading durante a verificacao
- Aceita prop `requiredRole` para controle de acesso por perfil

---

## 2. Fluxo de Dados

```
                        FLUXO DE AUTENTICACAO
                        =====================

    CLIENTE (Browser)                          SERVIDOR (Next.js API)
    ================                           ======================

    [1] Email + Senha
         |
         v
    POST /api/v1/auth/login  ------>  [2] Valida credenciais
                                          |
                                          +-> [2a] Busca usuario por email
                                          +-> [2b] Compara hash bcrypt
                                          |
                                          v
                                     [3] Gera JWT pair
                                     (access + refresh)
                                          |
                                          v
                                     [4] Salva refresh token
                                         na tabela Session
                                          |
                                          v
    [5] Recebe tokens   <--------  [6] Retorna { accessToken }
         |                                  + Set-Cookie: refreshToken
         v
    [7] Armazena no Zustand
         |  { user, isAuthenticated, error }
         v
    [8] Redireciona para /dashboard


    RENOVAÇÃO DE TOKEN
    ===================

    [A] Requisicao com access token expirado
         |
         v
    Interceptor Axios/Server  ------>  [B] POST /api/v1/auth/refresh
         |                                      (envia cookie refreshToken)
         v                                      |
    [C] Recebe novo          <--------  [D] Valida refresh token
        access token                       |  +-> Gera novo access token
                                          |  +-> Rotaciona refresh token
                                          v
                                     [E] Retorna { accessToken }
                                          + Set-Cookie: novo refreshToken


    GOOGLE OAUTH (Auth.js v5 — ADR-010)
    =====================================

    [1] Clica "Entrar com Google"
         |
         v
    GET /api/auth/signin/google  ------>  [2] Auth.js redireciona para
         |                                   Google Consent Screen
         v                                   |
    [3] Google redireciona de volta   <----- [4] Consentimento concedido
         |                                   (callback /api/auth/callback/google)
         v
    [5] Auth.js valida o code com Google
         |  +-> Busca/cria usuario via adapter minimo
         |      (getUserByAccount / getUserByEmail / createUser + linkAccount)
         v
    [6] Custom JWT layer emite access token RS256
         +-> Rotaciona refresh token (Session/familyId)
         |
         v
    [7] Set-Cookie: refreshToken (httpOnly)  <-------  nunca em query string
         |
         v
    [8] Redirect 302 para /dashboard (sem tokens na URL)
```

---

## 3. API Endpoints

### POST /api/v1/auth/register
**Descricao**: Cria uma nova conta de usuario.

| Campo | Tipo | Obrigatorio | Validacao |
|---|---|---|---|
| name | string | Sim | 2-50 caracteres |
| email | string | Sim | Email valido, unico |
| password | string | Sim | 8+ chars, maiusc, minusc, num, especial |
| passwordConfirmation | string | Sim | Identico a password |
| acceptTerms | boolean | Sim | Deve ser true |

**Response 201**: `{ user: { id, name, email, emailVerified }, message: "Email de verificacao enviado" }`
**Response 409**: `{ error: "EMAIL_ALREADY_EXISTS" }`
**Response 422**: `{ errors: { campo: ["mensagem"] } }`

### POST /api/v1/auth/login
**Descricao**: Autentica usuario com email e senha.

| Campo | Tipo | Obrigatorio |
|---|---|---|
| email | string | Sim |
| password | string | Sim |

**Response 200**: `{ accessToken, user: { id, name, displayName, email, role, plan, avatar } }` + Set-Cookie refreshToken (httpOnly, SameSite=Strict, Path=/api/v1/auth, Max-Age=30d)
**Response 422**: `{ error: { code: "VALIDATION_ERROR", message, details } }`
**Response 403**: `{ error: { code: "AUTH_ACCOUNT_LOCKED", retryAfter: 900 } }` (5 falhas consecutivas)
**Response 429**: `{ error: { code: "AUTH_RATE_LIMITED", retryAfter } }` (limite de volume por IP, 5/15min)
**Response 403**: `{ error: { code: "AUTH_ACCOUNT_SUSPENDED" } }` (isActive=false / deletedAt set)
**Response 401**: `{ error: { code: "AUTH_EMAIL_NOT_VERIFIED" } }` (emailVerified null)
**Response 401**: `{ error: { code: "AUTH_INVALID_CREDENTIALS" } }` (anti-enumeração — email inexistente retorna o mesmo 401)

### OAuth Google/Facebook e Magic Link (via Auth.js v5 — ADR-010)
**Descricao**: Os fluxos OAuth (Google/Facebook) e magic link sao delegados ao Auth.js v5
(`next-auth@5.0.0-beta.32`, adapter Prisma minimo, estrategia de sessao JWT), que possui
endpoints internos fixos em `/api/auth/*` (`signin`, `callback`, `session`, `csrf`,
`providers`). **Nao re-implementar o fluxo OAuth em `/api/v1/auth/*`.**
O magic link usa `EmailProvider` (id `email`, callback `/api/auth/callback/email`, token
single-use 15 min via `VerificationToken`). O vinculo OAuth usa `User.provider`/`providerId`
(sem model `Account` no MVP). **Nao alterar os schemas de `Session`/`VerificationToken` do §4.**

Apos o callback do NextAuth (identidade confirmada no callback `jwt`/`session` em
`src/auth/auth.config.ts`), a Custom JWT Layer emite o access token RS256 e cria a sessao de
refresh (tabela `Session`), guardando os tokens custom em `token.customAuth` (idempotencia por
sessao) e expondo `session.accessToken` (C14). O wrapper `src/app/api/auth/[...nextauth]/route.ts`
(`finalizeAuthResponse`) define o cookie `refreshToken` httpOnly+Secure (`Path=/api/v1/auth`,
`SameSite=Strict`, `Max-Age=30d`, preservando o cookie de sessao do Auth.js) e rescreve o
redirect final para `/dashboard` **sem tokens na URL**.

### POST /api/v1/auth/magic-link
**Descricao**: Envia magic link para o email informado.

| Campo | Tipo | Obrigatorio |
|---|---|---|
| email | string | Sim |

**Response 200**: `{ message: "Link de acesso enviado para seu email" }` (idêntico para email existente ou não — anti-enumeração)
**Response 429**: `{ error: "TOO_MANY_REQUESTS" }`

### POST /api/v1/auth/magic-link/verify
**Descricao**: Redime o token do magic link (single-use, expira em 15 minutos).
**Response 200**: `{ accessToken, user: { id, name, displayName, email, role, plan, avatar } }` + Set-Cookie refreshToken
**Response 410**: `{ error: "TOKEN_EXPIRED" }`

### POST /api/v1/auth/verify-email
**Descricao**: Redime o token de verificacao de email (single-use, expira em 24 horas) e marca o email do usuario como verificado (fecha o ciclo da task 6). Ao consumir o token, o `tokenVersion` e aumentado primeiro (fail-safe — invalida tokens previamente emitidos antes do write) e `User.emailVerified` recebe `new Date()`.

| Campo | Tipo | Obrigatorio |
|---|---|---|
| token | string | Sim |

**Response 200**: `{ message: "Email verificado com sucesso" }` (flat, sem wrapper `data`; `Cache-Control: no-store`)
**Response 401**: `{ error: "AUTH_EMAIL_VERIFY_INVALID" }` — token inexistente, tipo diferente de `EMAIL` (schema `VerificationToken.type` literal `"EMAIL"`), ja utilizado (single-use — `deleteMany` com `expiresAt > now` retorna `count !== 1`) ou usuario na janela LGPD (`isActive=false`/`deletedAt` — neste caso o token e consumido)
**Response 410**: `{ error: "AUTH_EMAIL_VERIFY_EXPIRED" }` — token expirado (24h), com remocao do token
**Response 422**: `{ error: "VALIDATION_ERROR" }` — token ausente, acima de 256 chars, campo extra (schema `.strict()`) ou corpo nao-JSON
**Response 500**: `{ error: "INTERNAL_ERROR", meta: { requestId } }` (C13)

**Decisoes**: reusar o tipo literal `"EMAIL"` existente no schema (prisma `VerificationToken.type String` — nao criar tipo novo); janela de 24h identica ao envio da task 6; valida LGPD antes de marcar verificado (usuario inativo/deletado nao reativa conta via token vigente). O frontend redireciona ao login apos confirmacao; ver `isAuthenticated` (design §6) que exige `emailVerified === true`.

### POST /api/v1/auth/verify-email/resend
**Descricao**: Reenvia o email de verificacao (RF-AUTH-005). Regenera um novo token `EMAIL` de 24h substituindo quaisquer tokens anteriores do mesmo endereco e envia por email; se o envio falhar, o token permanece persistido (precedente task 6) e a resposta e identica.

| Campo | Tipo | Obrigatorio |
|---|---|---|
| email | string | Sim |

**Response 200**: `{ message: "Email de verificacao enviado" }` (flat; `Cache-Control: no-store`) — identico para email existente ou nao (anti-enumeracao)
**Response 422**: `{ error: "VALIDATION_ERROR" }` — email invalido, campo extra (schema `.strict()`) ou corpo nao-JSON
**Response 500**: `{ error: "INTERNAL_ERROR", meta: { requestId } }` (C13)

**Decisoes**: no-op com resposta uniforme (200) para conta inexistente, inativa/deletada (janela LGPD) ou ja verificada (nao se reenvia para email verificado), com **piso de 250ms no no-op** (`equalizeNoopTiming` — anti-enumeracao por tempo, padrao forgot-password/magic-link); regeneracao via `$transaction` (`deleteMany` + `create` substitui o token anterior sem janela sem-token); sem rate limit nesta task — limite de **1/min por email** (RNF-AUTH-004) sera implementado em T27 (rate limiting Redis); log de seguranca com reqId/userId (sem PII).

### POST /api/v1/auth/forgot-password
**Descricao**: Inicia o processo de recuperacao de senha.

| Campo | Tipo | Obrigatorio |
|---|---|---|
| email | string | Sim |

**Response 200**: `{ message: "Se o e-mail estiver cadastrado, voce recebera instrucoes para redefinir sua senha" }` (flat, sem wrapper `data`; idêntico para email existente ou não — anti-enumeração; no-op para conta inativa/deletada também responde 200)

**Response 422**: `{ error: "VALIDATION_ERROR" }` (email invalido, campo extra ou corpo nao-JSON)
**Response 429**: `{ error: "AUTH_FORGOT_RATE_LIMIT", retryAfter: N }` — 3 pedidos/hora por email, janela 1h (env `MAX_PASSWORD_RESET_PER_EMAIL`). Contagem registrada antes do lookup do usuario (anti-spam — emails inexistentes consomem cota).
**Response 500**: `{ error: "INTERNAL_ERROR", meta: { requestId } }` (C13)

**Decisoes**: sem limite por IP; sem gate de `emailVerified` (qualquer email cadastrado ativo recebe reset, verificado ou nao); token `VerificationToken type=PASSWORD_RESET` 64 chars hex com `expiresAt` 1h; anti-enumeração por tempo e **piso** de 250ms no no-op (`equalizeNoopTiming`), nao equalizacao exata.

### POST /api/v1/auth/reset-password
**Descricao**: Redefine a senha do usuario.

| Campo | Tipo | Obrigatorio |
|---|---|---|
| token | string | Sim |
| password | string | Sim |
| passwordConfirmation | string | Sim |

**Response 200**: `{ message: "Senha redefinida com sucesso" }` (flat, sem wrapper `data`)
**Response 401**: `{ error: "AUTH_RESET_TOKEN_INVALID" }` (token inexistente, tipo != PASSWORD_RESET, token ja usado — single-use; ou usuario inativo/deletado na janela LGPD, sem reativar conta)
**Response 410**: `{ error: "AUTH_RESET_TOKEN_EXPIRED" }` (token venceu no prazo de 1h — nesse caso o token e apagado)
**Response 422**: `{ error: "VALIDATION_ERROR" }` (corpo invalido, senha fraca — mesmas regras do cadastro, passwordConfirmation divergente ou corpo nao-JSON; `.strict()` rejeita campos extras)
**Response 500**: `{ error: "INTERNAL_ERROR", meta: { requestId } }` (C13)

**Comportamento**: valida token → valida usuario ativo nao-deletado (LGPD: nunca reativar conta em janela de carencia via token valido) → redencao single-use (`deleteMany` garantindo `count === 1`) → bcrypt custo 12 (CHK-SEC-001) → invalida TODAS as sessoes ativas (`revokeAllSessions`, que tambem incrementa `tokenVersion` e espelha revogacao no Redis) **antes** do write da senha (ordem fail-safe) → atualiza `passwordHash` (+ `Cache-Control: no-store` na 200) → log de seguranca `AUTH_PASSWORD_RESET` com IP/userAgent.

**Decisoes**: sem rate limit nesta rota (resposta uniforme; limites Redis para todas as rotas sao task posterior T27); respostas de erro 401/410 identicas em shape (nao expor se o token existia); mensagem de sucesso plana (sem `securityTitle`/`content`).

### POST /api/v1/auth/refresh
**Descricao**: Renova o access token utilizando o refresh token do cookie.
**Response 200**: `{ accessToken: "..." }`
**Response 401**: `{ error: "INVALID_REFRESH_TOKEN" }`

### POST /api/v1/auth/logout
**Descricao**: Realiza logout seguro e revoga tokens.
**Response 200**: `{ message: "Logout realizado com sucesso" }`

### DELETE /api/v1/auth/account
**Descricao**: Solicita exclusao de conta (LGPD). Endpoint canônico de deleção — não duplicar em `/api/v1/users/me`.
**Headers**: `Authorization: Bearer <accessToken>`

| Campo | Tipo | Obrigatorio | Validacao |
|---|---|---|---|
| email | string | Sim | Deve ser identico ao email do usuario logado (confirmacao digitada, RF-AUTH-008) |

**Response 200**: `{ message: "Conta marcada para exclusao. Voce tem 30 dias para reverter." }` (mensagem idêntica em qualquer caso — anti-enumeração)

---

## 4. Database Schema

### Tabela: User

```prisma
// Fonte da verdade: prisma/schema.prisma (seguir sempre o schema real)
model User {
  id               String       @id @default(uuid())
  name             String
  displayName      String
  email            String       @unique
  emailVerified    DateTime?
  passwordHash     String?
  role             UserRole     @default(USER) // UserRole: USER | PROFESSIONAL | ADMIN
  plan             UserPlan     @default(FREE) // UserPlan: FREE | PLUS — dimensão separada do role
  provider         AuthProvider @default(EMAIL) // EMAIL | GOOGLE | FACEBOOK
  providerId       String       // EMAIL → email normalizado minúsculo; OAuth → subject ID
  avatar           String?
  birthDate        DateTime?
  astrologicalSign String?
  mayanKin         String?
  personalArcana   Int?
  tokenVersion     Int          @default(0) // revogação imediata de role/plan/suspensão/reset de senha/logout-all (§7.4; fonte-da-verdade — Redis é cache espelhado)
  isActive         Boolean      @default(true) // soft delete: filtros usam isActive = true AND deletedAt IS NULL
  deletedAt        DateTime?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  sessions         Session[]
  userProfile      UserProfile?
  readings         Reading[]
  posts            Post[]

  @@unique([provider, providerId])
}

enum UserRole {
  USER
  PROFESSIONAL
  ADMIN
}

enum UserPlan {
  FREE
  PLUS
}

enum AuthProvider {
  EMAIL
  GOOGLE
  FACEBOOK
}

model Session {
  id                String    @id @default(uuid())
  userId            String
  tokenHash         String    @unique // SHA-256 do refresh token — nunca armazenar em texto plano
  familyId          String    // família do refresh token (rotação mantém o mesmo familyId)
  tokenId           String    // identifica cada rotação dentro da família
  replacedByTokenId String?   // token que substituiu este (detecção de reuso)
  revokedAt         DateTime?
  userAgent         String?
  ipAddress         String?
  expiresAt         DateTime
  createdAt         DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([familyId])
}

model VerificationToken {
  id         String   @id @default(uuid())
  identifier String   // email do usuario
  token      String   @unique
  type       String   // "EMAIL" | "PASSWORD_RESET" | "MAGIC_LINK"
  expiresAt  DateTime
  createdAt  DateTime @default(now())
}
```

---

## 5. Estado (Zustand)

### AuthStore

```typescript
interface AuthState {
  // Estado
  user: {
    id: string;
    name: string;
    displayName: string;
    email: string;
    role: 'USER' | 'PROFESSIONAL' | 'ADMIN';
    plan: 'FREE' | 'PLUS';
    avatar: string | null;
    emailVerified: boolean;
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Acoes
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => void; // redirect
  sendMagicLink: (email: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (email: string) => Promise<void>;
  refreshSession: () => Promise<boolean>;
  clearError: () => void;
}
```

**Comportamento**:
- `isLoading` e `true` durante qualquer operacao assincrona de auth
- `error` e automaticamente limpo apos 5 segundos (useEffect)
- `user` e persistido no localStorage (para evitar re-login em reload)
- `isAuthenticated` e derivado de `user !== null && user.emailVerified === true`

---

## 6. Rotas da Aplicacao

| Rota | Componente | Protegida | Descricao |
|---|---|---|---|
| `/login` | LoginForm | Nao | Pagina de login principal |
| `/register` | RegisterForm | Nao | Pagina de cadastro |
| `/auth/magic-link` | MagicLinkForm | Nao | Solicitacao de magic link |
| `/auth/verify-email` | VerifyEmailPage | Nao | Tela "verifique seu email" |
| `/auth/reset-password` | ResetPasswordForm | Nao | Redefinicao de senha |
| `/auth/callback/magic-link` | MagicLinkCallback | Nao | Callback magic link (redime token via `POST /api/v1/auth/magic-link/verify`) |
| `/dashboard` | DashboardPage | Sim | Redirecionamento pos-login |

> O callback OAuth (Google/Facebook) acontece no caminho fixo do NextAuth (`/api/auth/callback/google`) — não há página frontend própria em `/auth/callback/google`.

---

## 7. Seguranca

### 7.1 Protecao CSRF
- CSRF aplica-se **apenas aos endpoints que usam cookies** (`/api/v1/auth/login|refresh|logout|register`, callbacks OAuth/magic-link); endpoints apenas-Bearer não exigem
- Double-submit token: cookie `__Host-csrf-token` + header `X-Requested-With: XMLHttpRequest` (validação: valor do cookie == valor do header)
- `/api/auth/*` mantém o CSRF nativo do NextAuth.js
- Em dev (http, localhost), usar variante sem `__Host-` prefix para não derrubar o cookie

### 7.2 Cookies Seguros
- `refreshToken`: `httpOnly=true`, `secure=true`, `sameSite=strict`, `path=/api/v1/auth`, `maxAge=2592000` (30 dias)
- `__Host-csrf-token`: `httpOnly=false`, `secure=true`, `sameSite=strict`, `path=/`

### 7.3 Protecao de Senha
- Senhas hasheadas com bcryptjs, custo 12
- Senhas nunca logadas ou incluídas em respostas de API
- Rate limiting por IP e por email simultaneamente
- Bloqueio temporario apos 5 falhas consecutivas em 15 minutos (`retryAfter: 900`); ADMIN/SUPER ADMIN: 20 falhas em 15 minutos (ADR-009 Gate C)

### 7.4 Revogacao Imediata (claim `tokenVersion`)
- O access token carrega a claim `tokenVersion` (payload: `sub`, `role`, `plan`, `tokenVersion`, `iat`, `exp`); **permissoes nao vao no token** — derivadas server-side a partir do `role`
- `tokenVersion` e incrementada em mudanca de role/plan, suspensao, reset de senha ou "logout all"
- O middleware `verifyToken` valida `tokenVersion` contra Redis a cada requisicao autenticada — revogacao de role/plan/suspensao aplica em tempo real (nao depende do TTL de 15 min do access token)
- Requisicoes com privilegio ADMIN fazem re-checagem de `isActive = true AND deletedAt IS NULL` no banco

### 7.5 Validacao de Input
- Todas as entradas validadas com Zod no servidor (server-side validation)
- Sanitizacao de inputs contra XSS e injecao SQL (protecao automatica do Prisma)
- Headers de seguranca: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`

### 7.6 Logging de Seguranca
- Registro de todas as tentativas de login (sucesso e falha)
- Registro de reset de senha com IP e user agent
- Registro de criacao e exclusao de contas
- Logs armazenados com retencao de 90 dias

> **Soft-delete no refresh:** o middleware `verifyToken`/`POST /api/v1/auth/refresh` deve validar `isActive = true AND deletedAt IS NULL` no servidor a cada renovacao — um usuario na janela LGPD (30 dias) nunca re-autentica.