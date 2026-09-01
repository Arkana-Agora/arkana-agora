# Autenticação — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Autenticação | **Versão**: MVP

---

## Descrição

O módulo de autenticação do **Arkana Agora** é responsável por gerenciar o ciclo de vida do usuário, desde o login inicial até o encerramento da conta. A camada de login do MVP é o **Auth.js v5** (`next-auth@5.0.0-beta.32` pinado — ADR-010, que supersede a cláusula "NextAuth.js v4 + adapter Prisma" do ADR-009) com **adapter Prisma mínimo** e estratégia de sessão **JWT**: **Google OAuth** e **magic link** são os fluxos do MVP, e a sessão real é o **cookie JWT do Auth.js** exposto em `/api/auth/*` (handler em `src/app/api/auth/[...nextauth]`). A **Custom JWT Layer** (access RS256 de 15 min + refresh rotativo de 30 dias, ADR-009 Gate B) é o estado-alvo da **Sprint 1**, com ponto de anexo nos callbacks `jwt`/`session` de `src/auth/auth.config.ts`. E-mail/senha (credentials), Facebook OAuth e as rotas `/api/v1/auth/*` (incluindo o rate limit de magic link) também são **Sprint 1**.

O magic link usa o `EmailProvider` do Auth.js (id `"email"`, callback `/api/auth/callback/email`): token **single-use** com validade de **15 minutos** via model `VerificationToken` (`type = "MAGIC_LINK"`, deletado na redenção); em dev, sem SMTP, `AUTH_EMAIL_SKIP_SEND=true` loga o link no console em vez de enviar. O vínculo OAuth usa `User.provider`/`providerId` (`@@unique([provider, providerId])`, normalização H-2) — sem model `Account` no MVP (provedor único por usuário). A recuperação de senha e a exclusão completa da conta seguem o design de `docs/04-api/authentication.md` e `.specs/001-auth/design.md` (Sprint 1), em conformidade com a LGPD (soft delete com janela de 30 dias).

---

## Funcionalidades

- **Login por magic link** — MVP: `EmailProvider` do Auth.js, token single-use válido por 15 minutos (`VerificationToken`, `type = "MAGIC_LINK"`)
- **Login via OAuth (Google)** — MVP: vínculo via `User.provider`/`providerId`, sem model `Account` (provedor único no MVP); provider condicional a `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`
- **Sessão JWT do Auth.js** — MVP: cookie JWT (`session: { strategy: "jwt" }`), sem gravação de sessão no banco
- **Proteção de rotas** — MVP (duas camadas): `src/proxy.ts` (Next 16, matcher `/dashboard/:path*`, validando via `getToken({ secret: AUTH_SECRET })`) + guard de auth no layout do route group `src/app/(app)/layout.tsx` (server component: `auth()` e `redirect("/login")` sem sessão — adicionado na F2B, defesa em profundidade)
- **Cadastro por e-mail e senha** — Sprint 1: validação de formato, força da senha e verificação de e-mail (credentials)
- **Login via OAuth (Facebook)** — Sprint 1 (não faz parte da camada de login do MVP, ADR-010)
- **Recuperação de senha** — Sprint 1: token temporário com expiração de 1 hora
- **Rotas de rate limit de magic link** — Sprint 1: `POST /api/v1/auth/magic-link` (429 `AUTH_MAGIC_LINK_RATE_LIMIT`, máx. 3/hora por e-mail)
- **Custom JWT Layer** — Sprint 1: access token (15 min, RS256) + refresh token rotativo (30 dias, cookie httpOnly `path=/api/v1/auth`)
- **Exclusão de conta (LGPD)** — Sprint 1: soft delete (`deletedAt`) com janela de restauração de 30 dias
- **Sessões ativas** — Sprint 1: visualização e revogação de dispositivos conectados

---

## Fluxo Principal (MVP)

1. O usuário acessa `/login` e escolhe **magic link** ou **Entrar com Google**
2. **Magic link**: o usuário informa o e-mail; o `EmailProvider` do Auth.js gera o token em `VerificationToken` e envia o link (15 min, single-use; em dev, `AUTH_EMAIL_SKIP_SEND=true` loga o link no console)
3. O clique no link autentica no callback `/api/auth/callback/email` (o token é deletado na redenção — single-use)
4. **Google OAuth**: o Auth.js redireciona para o consent screen; no callback `/api/auth/callback/google`, o adapter mínimo busca/cria o usuário (`getUserByAccount`/`getUserByEmail`/`createUser` + `linkAccount`)
5. A sessão é o **cookie JWT do Auth.js** (JWT strategy) — o Auth.js não grava sessões no banco
6. Rotas protegidas (`/dashboard/:path*`) são validadas em `src/proxy.ts` via `getToken({ secret: AUTH_SECRET })` e, em nível de route group, pelo guard `src/app/(app)/layout.tsx` (`auth()` + `redirect("/login")` — F2B); sem sessão válida, redireciona para `/login`
7. **Sprint 1**: a Custom JWT Layer assume após o callback (callbacks `jwt`/`session` em `src/auth/auth.config.ts`): access token (15 min, RS256) + refresh token rotativo (30 dias)
8. **Sprint 1**: rate limit de magic link (3/hora), recuperação de senha (1h) e exclusão de conta (LGPD, 30 dias)

---

## Versão

| Feature | Versão |
|---|---|
| Login OAuth (Google) | MVP |
| Magic Link | MVP |
| Sessão JWT do Auth.js (`/api/auth/*`) | MVP |
| Proteção de rotas (`src/proxy.ts` + `src/app/(app)/layout.tsx`) | MVP |
| Cadastro e-mail/senha | Sprint 1 |
| Login OAuth (Facebook) | Sprint 1 |
| Rotas de rate limit de magic link (`/api/v1/auth/magic-link`) | Sprint 1 |
| Custom JWT Layer (access/refresh) | Sprint 1 |
| Exclusão de conta (LGPD) | Sprint 1 |
| Verificação de e-mail | Sprint 1 |

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
| `resend` | Biblioteca | Provedor de e-mail transacional da issue #3 (Sprint 1; **instalado no F1/T1**) |
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
