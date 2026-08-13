# ADR-010: Auth.js v5 beta + adapter mínimo

### Status
**Aceito** ✅ — **supersede** a cláusula "NextAuth.js v4 + adapter Prisma" do ADR-009 (Gate B)

### Contexto
O ADR-009 definiu uma camada de login via NextAuth.js v4 + Custom JWT por cima. Na Sprint 0,
a dependência `next-auth` v4 foi removida do `package.json`: o peer range da v4 exclui
Next.js 16 e React 19, e `cookies()`/`headers()` síncronos quebram no App Router. Além disso,
no Next 16 o `middleware.ts` foi renomeado para `proxy.ts`. O `@auth/core` 0.41.x (auth.js v5
beta) introduz um **bug de segurança** corrigido apenas a partir do beta.32
(GHSA-8fpg-xm3f-6cx3 — falha-open de verificação de e-mail ≤ beta.31), exigindo pin exato.

O fluxo de magic link via `EmailProvider` do Auth.js v5 **exige um database adapter** — não
existe caminho "no-adapter" para o callback `/api/auth/callback/email`. O schema do MVP (D3)
tem 5 models autorizados e **não possui model `Account`**: o vínculo OAuth é representado
pelos campos `User.provider` + `User.providerId` (`@@unique([provider, providerId])`,
ADR-009 Gate A). Os models `Session`/`VerificationToken` são cópia fiel de
`.specs/001-auth/design.md` §4 e ficam **intocados**.

### Decisão

1. **`next-auth@5.0.0-beta.32` pinado exatamente** (compatível Next 16/React 19; ≥ beta.32
   mitiga GHSA-8fpg-xm3f-6cx3). `nodemailer` + `@types/nodemailer` para o envio do magic link.
2. **Estratégia de sessão JWT** (`session: { strategy: "jwt" }`): o Auth.js não grava sessões
   no banco; o model `Session` custom (refresh rotation da Sprint 1) permanece exclusivo da
   Custom JWT Layer do ADR-009.
3. **Adapter Prisma mínimo** (`src/auth/prisma-adapter.ts`) implementando apenas os métodos do
   fluxo: `createVerificationToken`/`useVerificationToken` (→ `VerificationToken`,
   `type = "MAGIC_LINK"`), `getUserByEmail`/`getUser`/`createUser`/`updateUser` (→ `User`) e
   `getUserByAccount`/`linkAccount`/`unlinkAccount` (→ OAuth Google). **Não** implementa
   `createSession`/`getSessionAndUser`/`updateSession`/`deleteSession`.
4. **Magic link**: `EmailProvider` (id `"email"`, callback `/api/auth/callback/email`),
   `maxAge = 15 * 60` (15 min via `expiresAt`), token single-use (o `useVerificationToken`
   **deleta** o token na redempção). Sem SMTP configurado em dev, o guard
   `AUTH_EMAIL_SKIP_SEND=true` loga o link no console em vez de enviar (não bloqueia o fluxo);
   em `NODE_ENV === "production"` esse guard lança erro (nunca logar token de sessão). O
   `EmailProvider` exige `server` na construção: sem `SMTP_*` definidos, usa um objeto fallback
   `{ host: "localhost", port: 25, ignoreTLS: true }` que **nunca** é usado pelo fluxo (o
   `sendVerificationRequest` lança antes caso o SMTP não esteja configurado) — serve apenas
   para satisfazer o requerimento do provider.
5. **Vínculo OAuth sem model `Account`**: `getUserByAccount` consulta
   `User` por `provider`/`providerId`; `linkAccount` grava `provider`/`providerId` no `User`
   (`providerId` = OAuth subject ID). `unlinkAccount` é **no-op** (método não invocado pelo
   fluxo atual do Auth.js). Como `createUser` grava `provider = EMAIL` em todos os fluxos e
   `linkAccount` sobrescreve em seguida, na prática `provider` representa o **último provedor
   vinculado** (não o provedor de registro). Consequência de MVP: um `User` tem um único
   provedor de registro; re-login do mesmo e-mail por outro provedor **revincula silenciosamente**
   (sem conflito/confirmação — decisão de UX pendente). Multi-provedor por usuário exigirá
   model `Account` em Sprint 1+ (com backfill dos pares `provider`/`providerId` existentes).
6. **Envs**: `AUTH_URL` (origem canônica — impede host-header poisoning do magic link em prod),
   `AUTH_SECRET` (não `NEXTAUTH_SECRET`), `AUTH_TRUST_HOST` (lido do env — padrão `true` em
   dev), `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (não `GOOGLE_CLIENT_*`), `SMTP_*`/`EMAIL_FROM`.
7. **Proteção de rotas**: `src/proxy.ts` (Next 16) com matcher segmentado
   (`/dashboard/:path*`), validando o JWT via `getToken({ secret: AUTH_SECRET })` com
   `secureCookie` em protocolo `https:` (nome de cookie/salt do Auth.js diferem sob HTTPS).
8. **Provider Google condicional**: registrado somente quando `AUTH_GOOGLE_ID` e
   `AUTH_GOOGLE_SECRET` estão definidos — em dev sem credenciais, o magic link segue funcional.
9. **Normalização (H-2)**: `providerId` EMAIL = e-mail minúsculo, aplicada em `createUser` e
   `updateUser` (o callback `signIn` do Auth.js permanece `allow-all`). Buscas por e-mail e
   provedor filtram `deletedAt = null AND isActive = true` (contrato de contas ativas).
10. **Escopo de MVP**: e-mail/senha (credentials) e **Facebook OAuth** permanecem Sprint 1 —
    não fazem parte da camada de login Auth.js v5 deste MVP.

### Consequências

**Positivas:**
- Desbloqueia autenticação funcional no MVP com Next 16/React 19, mitigando o advisory de
  segurança (pin beta.32).
- Model `Session` custom intacto para a Sprint 1 (refresh rotation + `tokenVersion`),
  mantendo o design do ADR-009.
- `VerificationToken` reutilizado pelo fluxo de e-mail do Auth.js sem alteração de schema;
  single-use + 15 min cobrem expiração/uso único do RF-AUTH-003 (o limite de 3 links/hora do
  RF-AUTH-003 fica para a rota `/api/v1/auth/magic-link` da Sprint 1).

**Negativas:**
- Beta do Auth.js v5 exige pin exato e monitoramento de novos releases (upgrade planejado
  quando a v5 estabilizar).
- Com sessão JWT e sem `tokenVersion` (Sprint 1), **não há revogação server-side**: um cookie
  de sessão roubado permanece válido até a expiração (padrão 30 dias). Contas desativadas
  (`isActive = false`) são barradas nas consultas do adapter (login), mas sessões JWT já
  emitidas não são invalidadas — mitigação prevista no ADR-009 (Gate C + Redis) para a Sprint 1.
- Sem model `Account`, um `User` tem um único provedor no MVP; o **último provedor vinculado**
  sobrescreve o anterior (re-login por outro provedor revincula silenciosamente). Vincular
  múltiplos provedores exigirá migração em Sprint 1+ (model `Account`).
- `unlinkAccount` no-op é um débito conhecido (método não invocado hoje pelo Auth.js).

### Alternativas Consideradas

| Alternativa | Por que não escolhida |
|---|---|
| NextAuth.js v4 corrigida | Peer range exclui Next 16/React 19; `cookies()`/`headers()` síncronos quebram no App Router; exige fork/patch |
| Auth.js v5 sem adapter (no-adapter) | `EmailProvider` exige adapter para o callback `/api/auth/callback/email` — não existe caminho sem adapter |
| Adapter oficial `@auth/prisma-adapter` | Exige models `Account`/`Session` canônicos do Auth.js; colidiria com o model `Session` custom (Sprint 1) e com o limite de 5 models do D3 |
| Manter v4 e adiar auth | Bloquearia M0 (magic link + Google OAuth) e a sequência F2A → F2B do plano |

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*
