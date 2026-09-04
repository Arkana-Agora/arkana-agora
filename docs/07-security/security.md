# Segurança — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Segurança | **Versão**: MVP

---

## Descrição

O módulo de Segurança do **Arkana Agora** define as medidas técnicas e organizacionais para proteger a plataforma, os dados dos usuários e a infraestrutura contra ameaças cibernéticas. A segurança é tratada em camadas: autenticação forte, proteção da API, transporte seguro, gestão de segredos, segurança de dependências e resposta a incidentes. Todas as medidas seguem as melhores práticas da OWASP e são alinhadas aos requisitos da LGPD para proteção de dados pessoais.

Este documento serve como referência para desenvolvedores e equipe de infraestrutura, estabelecendo padrões obrigatórios para toda a base de código. A conformidade com estas diretrizes é verificada em code review, CI/CD pipelines e auditorias de segurança periódicas.

---

## Autenticação

### Hash de Senhas

| Parâmetro | Valor | Justificativa |
|---|---|---|
| Algoritmo | `bcrypt` | Padrão da indústria, resistente a brute-force |
| Salt rounds | 12 | Equilíbrio entre segurança e performance (~250ms por hash) |
| Tamanho mínimo da senha | 8 caracteres | Conformidade OWASP |
| Validação de força | `zxcvbn` (score ≥ 3) | Detecção de senhas fracas |

```typescript
// Exemplo de hash
const saltRounds = 12;
const hashedPassword = await bcrypt.hash(password, saltRounds);

// Exemplo de verificação
const isValid = await bcrypt.compare(inputPassword, hashedPassword);
```

> **Rotas que gravam senha (bcrypt custo 12 obrigatório):** `POST /api/v1/auth/register` (T6) e
> `POST /api/v1/auth/reset-password` (T12) — ambas usam `BCRYPT_COST = 12` ao gravar
> `passwordHash`. Nenhuma senha em texto puro, em logs ou em banco (CA-01).

### JWT (JSON Web Tokens) — fluxo híbrido (ADR-009)

> **Status:** a emissão/verificação de tokens está **implementada** em
> `src/services/token-service.ts` (`signAccessToken`, `verifyAccessToken`,
> `createRefreshSession`, `rotateRefresh`, `bumpTokenVersion`, `revokeRefreshSession`,
> `revokeAllSessions`). As rotas de refresh (`POST /api/v1/auth/refresh`, T13) e logout
> (`POST /api/v1/auth/logout`, T14) estão **expostas** em
> `src/app/api/v1/auth/refresh/route.ts` e `src/app/api/v1/auth/logout/route.ts`.

| Parâmetro | Access Token | Refresh Token |
|---|---|---|
| Algoritmo | RS256 | Opaco (gerado via `randomBytes`); apenas o hash SHA-256 é persistido |
| Chave | Par RSA (2048 bits) | N/A (opaco, não assinado) |
| Expiração | 15 minutos | 30 dias |
| Armazenamento | Memória do cliente | Cookie httpOnly, Secure, SameSite=Strict + tabela `Session` (hash) |
| Rotação | Não | Sim (a cada uso, o anterior é invalidado, mantendo o `familyId`) |

```typescript
// Payload do access token (implementado em src/services/token-service.ts)
interface JWTPayload {
  sub: string;          // userId
  role: UserRole;
  plan: UserPlan;
  tokenVersion: number; // bump em mudança de role/plan, suspensão ou logout-all
  iat: number;          // issued at
  exp: number;          // expiration
}
// Permissões NÃO vão no token: derivadas server-side a partir do role.
// `verifyAccessToken` é fail-closed: valida tokenVersion contra Redis (cache) com fallback
// DB; requisições ADMIN re-checam isActive/deletedAt no banco.
```

### Refresh Token Rotation

1. O cliente envia o refresh token via cookie httpOnly (`path=/api/v1/auth`)
2. O servidor busca a sessão pelo hash SHA-256 do token e valida `expiresAt`/`revokedAt`
3. O servidor invalida o refresh token anterior (marca `replacedByTokenId`)
4. O servidor gera um novo access token e rotaciona o refresh token (mesmo `familyId`)
5. O novo refresh token é enviado em cookie
6. Se um refresh token já rotacionado for reenviado (reuso), todos os tokens da família (`familyId`) são revogados (detecção de roubo)

### Logout e revogação de sessão (T14 implementado)

A rota `POST /api/v1/auth/logout` (`src/app/api/v1/auth/logout/route.ts`) delega a revogação
aos helpers compartilhados de `src/services/token-service.ts` — **nunca duplica** lógica de
rotação/revogação (S10):

- **`revokeRefreshSession(rawToken)`** — revoga a `Session` cujo hash SHA-256 do token casa;
  idempotente (sessão inexistente/já revogada → `revoked: false`, sem erro). Usado no logout
  padrão (single device), lendo o refresh do cookie httpOnly.
- **`revokeAllSessions(userId)`** — revoga **todas** as `Session` do usuário **pareado com bump
  de `tokenVersion`** (contrato de segurança architecture-review). O bump invalida **todos** os
  access tokens emitidos (validados fail-closed contra Redis/DB em `verifyAccessToken`). Usado
  quando o body `{ allDevices: true }` é enviado no logout **e** no sucesso de
  `POST /api/v1/auth/reset-password` (T12) — redefinir a senha derruba todas as sessões ativas
  (incl. access tokens emitidos antes do reset).

O logout sempre limpa o cookie de refresh (`Set-Cookie: Max-Age=0`) e retorna `200 { message }`
flat (sem wrapper `data`), com `Cache-Control: no-store`.

---

## Segurança da API

### Rate Limiting

> **Status:** o rate limiting de login, magic link e forgot-password está **implementado** em
> `src/lib/rate-limit.ts` (em memória, por instância). O restante da tabela abaixo é o
> **estado-alvo** (planejado).

| Endpoint | Limite | Janela | Usuários Autenticados |
|---|---|---|---|
| `POST /api/v1/auth/login` (lockout de conta) | 5 falhas consecutivas | 15 min | Não se aplica |
| `POST /api/v1/auth/login` (volume por IP) | 5 req | 15 min | Não se aplica |
| `POST /api/v1/auth/magic-link` (por email) | 3 req | 1 hora | Não se aplica |
| `POST /api/v1/auth/magic-link` (por IP) | 20 req | 1 hora | Não se aplica |
| `POST /api/v1/auth/register` | 3 req | 15 min | Não se aplica |
| `POST /api/v1/auth/forgot-password` | 3 req | 1 hora | Não se aplica |
| `GET /api/v1/*` | 100 req | 1 min | 300 req / 1 min |
| `POST /api/v1/*` | 50 req | 1 min | 150 req / 1 min |
| `POST /api/v1/readings` | 3/dia | dia | 10/dia |

**Implementado (login + magic-link + forgot-password):**
- **Lockout de conta**: 5 falhas consecutivas → 403 `AUTH_ACCOUNT_LOCKED` com `retryAfter: 900` (15 min). Resetado em login bem-sucedido.
- **Limite de volume por IP**: 5 tentativas/15min → 429 `AUTH_RATE_LIMITED` com `retryAfter`.
- **Magic link por email**: 3/hora por email → 429 `AUTH_MAGIC_LINK_RATE_LIMIT` com `retryAfter` (1h window, `src/lib/rate-limit.ts` `isMagicLinkLimited`/`recordMagicLinkRequest`).
- **Magic link por IP**: 20/hora por IP → 429 `AUTH_MAGIC_LINK_RATE_LIMIT` com `retryAfter` (1h window, `src/lib/rate-limit.ts` `isMagicLinkIpLimited`/`recordMagicLinkIpAttempt`; mesmo código do limite por email — não há `AUTH_MAGIC_LINK_IP_RATE_LIMIT`).
- **Forgot-password por email**: 3/hora por email → 429 `AUTH_FORGOT_RATE_LIMIT` com `retryAfter` (1h window, `src/lib/rate-limit.ts` `isPasswordResetLimited`/`recordPasswordResetRequest`, env `MAX_PASSWORD_RESET_PER_EMAIL`). A contagem é registrada antes da verificação de existência do usuário (anti-spam).
- **Audit de reset de senha** (design §7.6): pedidos de recuperação de senha são logados com **IP** (`x-forwarded-for`) e **user agent** em `[auth:forgot-password]` (`src/app/api/v1/auth/forgot-password/route.ts`).
- **`POST /api/v1/auth/reset-password` (T12) NÃO tem rate limit** — decisão consciente; rate limiting (incl. Redis-based) é tarefa posterior (T27). Não confundir com o limite de **emissão** de tokens (forgot-password 3/h por email), que já existe.
- `resetRateLimiter()` limpa o store (usado em testes).

### CORS (Cross-Origin Resource Sharing)

```typescript
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS.split(','),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, // 24h preflight cache
};
```

### Helmet Middleware

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "https://cdn.arkanaagora.com.br"],
      connectSrc: ["'self'", "https://api.mercadopago.com"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

### Validação de Input (Zod)

Todos os inputs da API são validados com **Zod** antes do processamento:

```typescript
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  displayName: z.string().min(2).max(50),
});
```

### Prevenção de Injeção SQL

O **Prisma ORM** utiliza query parameterization nativamente, eliminando o risco de injeção SQL:

```typescript
// ✅ Seguro — Prisma parameteriza automaticamente
const user = await prisma.user.findUnique({
  where: { email: userEmail },
});

// ❌ Nunca fazer — concatenação de strings
// const user = await prisma.$queryRaw(`SELECT * FROM users WHERE email = '${userEmail}'`);
```

### Prevenção de XSS

- **Servidor**: Sanitização com `DOMPurify` em todos os inputs de usuário antes do armazenamento
- **Cliente**: React/Next.js sanitiza automaticamente por padrão (JSX escaping)
- **Headers CSP**: Restringe fontes de scripts, estilos e imagens

```typescript
import DOMPurify from 'isomorphic-dompurify';

const cleanInput = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
});
```

---

## Segurança de Transporte

| Medida | Configuração | Justificativa |
|---|---|---|
| TLS | Versão 1.3 (mínimo 1.2) | Criptografia em trânsito |
| HSTS | `max-age=31536000; includeSubDomains; preload` | Força HTTPS |
| CSP | Restrito ao domínio próprio | Prevenção de XSS |
| Certificate | Let's Encrypt (auto-renewal) | Certificado válido e atualizado |

---

## Gestão de Segredos

### Princípios

1. **Nenhum segredo no código-fonte** — use variáveis de ambiente
2. **`.env.example`** — arquivo de template com nomes das variáveis, sem valores
3. **`.gitignore`** — `.env` sempre ignorado no versionamento
4. **Segredos em produção** — usar secret manager do provedor (ex.: consoles Vercel/Neon/Upstash) ou gerenciador de segredos dedicado
5. **Rotação de chaves** — chaves JWT rotacionadas a cada 90 dias

### Variáveis de Ambiente Críticas

```bash
# .env.example — NÃO incluir valores reais
DATABASE_URL=
JWT_PRIVATE_KEY=
JWT_PUBLIC_KEY=
MP_ACCESS_TOKEN=
FCM_SERVER_KEY=
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
REDIS_URL=
# Objeto storage é Cloudflare R2 (S3-compatible), não AWS S3
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=https://assets.arkanaagora.com.br
```

### Verificação em CI/CD

- Pipeline CI verifica se `.env` foi adicionado ao commit (falha o build)
- Scanner de segredos (`git-secrets` ou `trufflehog`) executado em cada PR
- Alerta automático se segredos forem detectados no histórico do Git

---

## Segurança de Dependências

| Ferramenta | Frequência | Ação |
|---|---|---|
| `bun audit` | A cada commit (CI) | Falha o build se encontrar vulnerabilidades críticas/alta |
| Dependabot | Diário | Abre PRs automáticas com atualizações de segurança |
| Snyk | Semanal | Scan completo de vulnerabilidades com relatório |
| Lockfile | Sempre | `bun.lock` obrigatório (MVP, bun) — sem alterações manuais |

### Política de Atualização

- **Vulnerabilidades críticas**: Corrigida em até 24 horas
- **Vulnerabilidades altas**: Corrigida em até 7 dias
- **Vulnerabilidades médias**: Corrigida no próximo sprint
- **Vulnerabilidades baixas**: Avaliada e corrigida conforme disponibilidade

---

## Testes de Penetração (Pentest)

| Atividade | Frequência | Responsável |
|---|---|---|
| Pentest anual completo | Anual | Empresa terceirizada certificada |
| Pentest de nova feature | Antes de lançamento V2+ | Equipe de segurança interna |
| Bug bounty program | Contínuo | Comunidade (HackerOne/Bugcrowd) |
| Scan de vulnerabilidades automático | Semanal | Snyk + OWASP ZAP |

### Escopo do Pentest

- Autenticação e autorização
- API REST (todos os endpoints)
- Upload de arquivos
- Pagamentos e checkout
- Gestão de sessões
- Proteção contra OWASP Top 10

---

## Resposta a Incidentes

### Runbook de Incidente

1. **Detecção** — alertas de monitoramento (Sentry, Grafana/Prometheus, logs)
2. **Triagem** — classificar severidade (P1 a P4)
3. **Contenção** — isolar sistemas afetados, bloquear IPs maliciosos
4. **Comunicação** — notificar equipe, stakeholders e (se LGPD) titulares e ANPD
5. **Erradicação** — remover a causa raiz
6. **Recuperação** — restaurar serviços com monitoramento intensivo
7. **Post-mortem** — documento de lições aprendidas em até 5 dias úteis

### Escalonamento

| Severidade | Tempo de resposta | Escala para |
|---|---|---|
| P1 (crítico) | 15 minutos | CTO, DPO, equipe completa |
| P2 (alto) | 1 hora | Tech Lead, equipe de segurança |
| P3 (médio) | 4 horas | Equipe responsável |
| P4 (baixo) | Próximo dia útil | Equipe responsável |

---

## Critérios de Aceite

- **CA-01**: Todas as senhas devem ser armazenadas com bcrypt (12 rounds) — nenhuma senha em texto puro, em logs ou em banco
- **CA-02**: Todos os endpoints da API devem possuir rate limiting configurado e testado
- **CA-03**: O scanner de segredos deve ser executado em 100% dos pull requests antes do merge
- **CA-04**: O certificado TLS deve ser renovado automaticamente e possuir validade mínima de 90 dias
- **CA-05**: O tempo médio de detecção (MTTD) de incidentes críticos deve ser inferior a 15 minutos