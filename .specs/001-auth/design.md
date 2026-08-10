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


    GOOGLE OAUTH
    ============

    [1] Clica "Entrar com Google"
         |
         v
    GET /api/v1/auth/google/signin  ------>  [2] Redireciona para Google
                                              Consent Screen
         |                                      |
         v                                      v
    [3] Callback                        [4] Google retorna code
         |                                      |
         v                                      v
    GET /api/v1/auth/google/callback  <--- [5] Troca code por token
                                              |
                                              v
                                         [6] Busca/cria usuario
                                             com perfil Google
                                              |
                                              v
                                         [7] Gera JWT pair
                                              |
                                              v
    [8] Recebe tokens  <-------------  [9] Redirect com tokens
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

**Response 200**: `{ accessToken, user: { id, name, email, role, avatarUrl } }`
**Response 401**: `{ error: "INVALID_CREDENTIALS" }`
**Response 429**: `{ error: "TOO_MANY_ATTEMPTS", retryAfter: 3600 }`

### POST /api/v1/auth/google/signin
**Descricao**: Inicia o fluxo OAuth com Google.
**Response 302**: Redirect para Google Consent Screen.

### GET /api/v1/auth/google/callback
**Descricao**: Callback do Google OAuth apos consentimento.
**Response 302**: Redirect para `/dashboard?accessToken=...&refreshToken=...`

### POST /api/v1/auth/magic-link
**Descricao**: Envia magic link para o email informado.

| Campo | Tipo | Obrigatorio |
|---|---|---|
| email | string | Sim |

**Response 200**: `{ message: "Link de acesso enviado para seu email" }`
**Response 404**: `{ error: "EMAIL_NOT_FOUND" }`
**Response 429**: `{ error: "TOO_MANY_REQUESTS" }`

### POST /api/v1/auth/verify-email
**Descricao**: Verifica o endereco de email do usuario.

| Campo | Tipo | Obrigatorio |
|---|---|---|
| token | string | Sim |

**Response 200**: `{ message: "Email verificado com sucesso" }`
**Response 410**: `{ error: "TOKEN_EXPIRED" }`

### POST /api/v1/auth/forgot-password
**Descricao**: Inicia o processo de recuperacao de senha.

| Campo | Tipo | Obrigatorio |
|---|---|---|
| email | string | Sim |

**Response 200**: `{ message: "Email de recuperacao enviado" }`
**Response 404**: `{ error: "EMAIL_NOT_FOUND" }` (nao revela existencia)

### POST /api/v1/auth/reset-password
**Descricao**: Redefine a senha do usuario.

| Campo | Tipo | Obrigatorio |
|---|---|---|
| token | string | Sim |
| password | string | Sim |
| passwordConfirmation | string | Sim |

**Response 200**: `{ message: "Senha redefinida com sucesso" }`
**Response 410**: `{ error: "TOKEN_EXPIRED" }`

### POST /api/v1/auth/refresh
**Descricao**: Renova o access token utilizando o refresh token do cookie.
**Response 200**: `{ accessToken: "..." }`
**Response 401**: `{ error: "INVALID_REFRESH_TOKEN" }`

### POST /api/v1/auth/logout
**Descricao**: Realiza logout seguro e revoga tokens.
**Response 200**: `{ message: "Logout realizado com sucesso" }`

### DELETE /api/v1/auth/account
**Descricao**: Solicita exclusao de conta (LGPD).
**Headers**: `Authorization: Bearer <accessToken>`
**Response 200**: `{ message: "Conta marcada para exclusao. Voce tem 30 dias para reverter." }`

---

## 4. Database Schema

### Tabela: User

```prisma
model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
n  emailVerified DateTime?
  passwordHash  String?
  role          String    @default("user") // "user" | "plus" | "pro" | "admin" | "superadmin"
  avatarUrl     String?
  googleId      String?   @unique
  birthDate     DateTime?
  deletedAt     DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions      Session[]
  profiles      Profile?
  readings      Reading[]
  posts         Post[]

  @@map("users")
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  refreshToken String   @unique
  userAgent    String?
  ipAddress    String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  id        String   @id @default(cuid())
  identifier String  // email do usuario
  token      String   @unique
n  type      String   // "EMAIL" | "PASSWORD_RESET" | "MAGIC_LINK"
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@map("verification_tokens")
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
    email: string;
    role: 'user' | 'plus' | 'pro' | 'admin' | 'superadmin';
    avatarUrl: string | null;
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
| `/auth/callback/google` | GoogleCallback | Nao | Callback OAuth Google |
| `/auth/callback/magic-link` | MagicLinkCallback | Nao | Callback magic link |
| `/dashboard` | DashboardPage | Sim | Redirecionamento pos-login |

---

## 7. Seguranca

### 7.1 Protecao CSRF
- Todos os endpoints de mutacao (POST/PUT/DELETE) exigem header `X-Requested-With: XMLHttpRequest`
- CSRF token gerado no server e enviado via cookie `__Host-csrf-token`
- Validacao do token em cada requisicao protegida

### 7.2 Cookies Seguros
- `refreshToken`: `httpOnly=true`, `secure=true` (producao), `sameSite=strict`, `path=/api/v1/auth`, `maxAge=604800` (7 dias)
- `__Host-csrf-token`: `httpOnly=false`, `secure=true`, `sameSite=strict`, `path=/`

### 7.3 Protecao de Senha
- Senhas hasheadas com bcryptjs, custo 12
- Senhas nunca logadas ou incluidas em respostas de API
- Rate limiting por IP e por email simultaneamente
- Bloqueio temporario apos 5 falhas consecutivas (1 hora)

### 7.4 Validacao de Input
- Todas as entradas validadas com Zod no servidor (server-side validation)
- Sanitizacao de inputs contra XSS e injecao SQL (protecao automatica do Prisma)
- Headers de seguranca: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`

### 7.5 Logging de Seguranca
- Registro de todas as tentativas de login (sucesso e falha)
- Registro de reset de senha com IP e user agent
- Registro de criacao e exclusao de contas
- Logs armazenados com retencao de 90 dias