# Arquitetura do Sistema — arkana-agora

> Versão: 1.1 | Última atualização: 2026-10-03

---

## 1. Visão Geral

O **arkana-agora** é uma plataforma brasileira de Tarot, Cartas Ciganas (Lenormand) e rede social com leituras impulsionadas por IA. A arquitetura segue o padrão **monolito modular** com planejamento de evolução para **monorepo com microsserviços**.

### Diagrama de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENTES                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │  Browser     │  │  Mobile      │  │  Admin       │                  │
│  │  (Next.js)   │  │  (Expo RN)   │  │  (Next.js)   │                  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
└─────────┼─────────────────┼─────────────────┼──────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY (Caddy)                              │
│            api.arkanaagora.com.br / arkanaagora.com.br                  │
│         SSL, Rate Limiting, Static Assets (Cloudflare CDN)               │
└────────┬──────────────────┬──────────────────┬──────────────────────────┘
         │ REST/SSR         │ SSE              │ WebSocket
         ▼                  ▼                  ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐
│   Next.js App   │ │  AI Service  │ │  Socket.io       │
│   (port 3000)   │ │  (SSE stream)│ │  (port 3003)     │
│                 │ │  GPT-4o      │ │  Real-time       │
│  - Pages/SSR    │ │  openai-sdk │ │  - Feed updates  │
│  - API Routes   │ │              │ │  - Notifications │
│  - Server Comps │ │              │ │  - Presence      │
└────────┬────────┘ └──────┬───────┘ └────────┬─────────┘
         │                 │                  │
         ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     SERVICES / BUSINESS LOGIC                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ AuthService│ │ReadingSvc│ │SocialSvc│ │MarketSvc│ │PaymentSvc   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└────────┬────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │  PostgreSQL  │  │    Redis     │  │  Cloudflare  │                  │
│  │  (Neon)      │  │  (Upstash)   │  │  R2 (Assets) │                  │
│  │  via Prisma  │  │  Sessions    │  │              │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Arquitetura de Módulos

### 2.1 Next.js App Router

O aplicativo utiliza o **App Router** do Next.js 16 com as seguintes organizações:

```
src/
├── app/                    # Rotas (App Router)
│   ├── (auth)/             # Grupo de rotas de autenticação
│   │   ├── login/
│   │   ├── register/
│   │   └── callback/
│   ├── (app)/              # Rotas autenticadas (guard de auth em layout.tsx — F2B)
│   │   ├── dashboard/
│   │   ├── readings/
│   │   ├── feed/
│   │   ├── marketplace/
│   │   └── profile/
│   ├── api/                # API Routes
│   │   ├── auth/           # Auth.js v5 endpoints internos (callbacks, session, csrf) — ADR-010
│   │   ├── v1/auth/        # Auth REST custom (ADR-009): register, login, magic-link, magic-link/verify, forgot-password, reset-password, refresh, logout, verify-email, verify-email/resend
│   │   ├── v1/readings/    # CRUD de leituras
│   │   ├── v1/social/      # Feed, follows, posts
│   │   ├── v1/marketplace/ # Produtos, pedidos
│   │   └── v1/payments/    # Integração Mercado Pago
│   ├── layout.tsx
│   └── page.tsx            # Landing page
├── components/
│   ├── ui/                 # shadcn/ui (preset radix-nova — "New York" na nomenclatura antiga da CLI)
│   ├── cards/              # Componentes de cartas
│   ├── social/             # Feed, posts, comentários
│   └── layout/             # Header, sidebar, footer
├── lib/
│   ├── prisma.ts           # Cliente Prisma singleton
│   ├── auth.ts             # Configuração Auth.js v5 (ADR-010)
│   ├── ai.ts               # Cliente OpenAI (src/lib/ai/client.ts; openai SDK)
│   └── validators/         # Zod schemas
├── services/               # Lógica de negócio
│   ├── reading.service.ts
│   ├── social.service.ts
│   ├── payment.service.ts
│   └── ai.service.ts
├── stores/                 # Zustand stores
│   ├── reading.store.ts
│   ├── ui.store.ts
│   └── user.store.ts
└── types/                  # TypeScript types/interfaces
```

### 2.2 API Routes

As rotas de API seguem o padrão RESTful:

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/auth/...` | Endpoints internos Auth.js v5 (callbacks, session, csrf) — não renomeáveis |
| `POST` | `/api/v1/auth/...` | Auth REST custom (ADR-009): register, login, magic-link, magic-link/verify, forgot-password, reset-password, refresh, logout, verify-email, verify-email/resend |
| `GET` | `/api/v1/readings` | Listar leituras do usuário |
| `POST` | `/api/v1/readings` | Criar nova leitura |
| `GET` | `/api/v1/readings/[id]` | Buscar leitura específica |
| `GET` | `/api/v1/social/feed` | Feed social do usuário — **implementada (T052)** |
| `POST` | `/api/v1/social/posts` | Criar postagem — **implementada (T051)** |
| `POST` | `/api/v1/social/follow/:userId` | Seguir usuário — **implementada (T043, Phase 1)** |
| `GET` | `/api/v1/social/explore/{trending,hashtags,suggestions}` | Explore — **implementada (T053–T055)** |
| `GET` | `/api/v1/social/search` | Busca social (posts/users/hashtags) — **implementada (T056)** |
| `GET` | `/api/v1/social/posts/:id` | Detalhe do post — **implementada (T057)** |
| `GET` | `/api/v1/social/posts/:id/og-image` | Imagem OG do post (`optionalAuth`) — **implementada (T058)** |
| `POST` | `/api/v1/social/posts/images/presign` | Presign de imagens de post (R2) — **implementada (T064)** |
| `GET` | `/api/v1/social/polling/{posts,likes,comments,notifications}?since=` | Fallback REST do realtime (polling 30s enquanto o socket está desconectado) — **implementadas (T071, Phase 2.5)** |
| `GET` | `/api/v1/marketplace/products` | Listar produtos |
| `POST` | `/api/v1/payments/create` | Criar pagamento |
| `POST` | `/api/v1/webhooks/mercadopago` | Webhook Mercado Pago |

> **Divisão de rotas de auth (ADR-009; camada de login atualizada pelo ADR-010):** `/api/auth/*` é reservado aos endpoints internos do Auth.js v5 (caminho fixo da biblioteca). Todas as rotas REST próprias — incluindo auth — ficam versionadas em `/api/v1/*`. `/api/v1/auth/refresh` é a rota de rotação do refresh token (Sprint 1).

### 2.3 Mini Services

Serviços complementares que rodam em portas separadas:

| Serviço | Porta | Tecnologia | Responsabilidade |
|---------|-------|------------|-----------------|
| **Socket.io Service** (`socket-service/`) | 3003 | `node:http` + Socket.io (Node.js) | Real-time: feed, notificações, presença — **implementado** (Phase 2.5, T066–T075; `bun run dev:ws`) |
| **AI Service** (futuro) | 3004 | Node.js | Processamento assíncrono de leituras IA |
| **Worker** (futuro) | 3005 | BullMQ | Jobs em background (horóscopos diários, emails) |

---

## 3. Camadas da Arquitetura

### 3.1 Camada de Apresentação (Presentation)

**Responsabilidade**: Renderização de interface, interação do usuário, animações.

- **React Server Components** para renderização no servidor (SEO, performance)
- **Client Components** para interatividade (formulários, modais, animações)
- **Framer Motion** para transições e animações de cartas
- **shadcn/ui** (preset radix-nova — "New York" na nomenclatura antiga da CLI) como sistema de design base
- **Tailwind CSS 4** para estilização utility-first

```typescript
// Exemplo: Server Component com dados do servidor
export default async function ReadingPage({ params }: { params: { id: string } }) {
  const reading = await readingService.getById(params.id);
  return <ReadingDetail reading={reading} />; // Client Component
}
```

### 3.2 Camada de Aplicação (Application)

**Responsabilidade**: Orquestração de casos de uso, validação, transformação.

- **API Routes** do Next.js como controladores HTTP
- **Zod** para validação de entrada/saída
- **SSE** para streaming de interpretações IA
- **Auth.js v5** (`next-auth@5.0.0-beta.32`, ADR-010) como camada de login do MVP (Google OAuth + magic link, JWT strategy) + **Custom JWT Layer** (access RS256 / refresh rotativo) como sessão autenticada da Sprint 1 (ADR-009 Gate B). **Implementado (Módulo 1 Auth):** `src/services/token-service.ts` (sign/verify access RS256, refresh session, rotation, bumpTokenVersion, revokeRefreshSession, revokeAllSessions), `src/lib/rate-limit.ts` (lockout de conta + volume por IP + magic link 3/h por email e 3/h por IP + register 3/15min por email e 3/h por IP + forgot-password 3/h por email e 5/h por IP + verify-email/resend 1/min por email e 5/h por IP + restore-account 3/h por email; reset-password **sem rate limit próprio**), `src/lib/redis.ts` (singleton), `src/lib/validators/auth.ts` (`loginSchema`/`magicLinkSchema`/`magicLinkVerifySchema`/`forgotPasswordSchema`/`resetPasswordSchema`/`verifyEmailSchema`/`verifyEmailResendSchema`), rotas `POST /api/v1/auth/register` (T6), `POST /api/v1/auth/login` (T7), `POST /api/v1/auth/magic-link` (T9), `POST /api/v1/auth/magic-link/verify` (T10), `POST /api/v1/auth/forgot-password` (T11), `POST /api/v1/auth/reset-password` (T12), `POST /api/v1/auth/refresh` (T13), `POST /api/v1/auth/logout` (T14), `POST /api/v1/auth/verify-email` (T30) e `POST /api/v1/auth/verify-email/resend` (T30). **Frontend auth (Fase 6/7, T24/T25):** `AuthGuard` client-side (`src/components/auth/auth-guard.tsx` — `requiredRole?: UserRole` (`"USER" | "PROFESSIONAL" | "ADMIN"`), inicia `checked=false` com skeleton `role="status"`, valida sessão pós-montagem via `refreshSession()`, redirect `/login`, aceita `User | PartialUser` via `"role" in user`) + AuthStore Zustand completo (`src/stores/auth-store.ts` — T25: middleware `persist` chave `arkana-auth` no localStorage, `User.emailVerified: boolean` + `PartialUser` (C9), `isAuthenticated` derivado de `user != null && user.emailVerified`, error auto-clear 5s via timer no store, `loginWithGoogle`/`logout`/`deleteAccount`; `refreshSession()` — delega a `refreshAccessTokenOnce()` de `src/lib/auth-refresh.ts` (single-flight), retorna boolean; sucesso com `data.user` atualiza o user; sucesso só com `accessToken` **preserva** o user persistido; `network_error`/`server_error` **não** limpam o user (error transitório); `auth_failed`/`bad_response` limpam o user).

```typescript
// Exemplo: API Route com validação (autenticação via access token custom — ADR-009)
export async function POST(req: Request) {
  const payload = await verifyToken(req); // jwt.verify(..., { algorithms: ['RS256'] }) + tokenVersion check
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const data = CreateReadingSchema.parse(body);
  const reading = await readingService.create(payload.sub, data);
  return NextResponse.json(reading, { status: 201 });
}
```

### 3.3 Camada de Domínio (Domain)

**Responsabilidade**: Regras de negócio, lógica pura, independente de infraestrutura.

- **Services** (`src/services/`) contêm a lógica de negócio
- **Types** (`src/types/`) definem contratos de domínio
- Regras como: cálculo de arcano pessoal, validação de spreads, limites de plano

```typescript
// Exemplo: Service com lógica de domínio
export class ReadingService {
  async create(userId: string, data: CreateReadingDTO): Promise<Reading> {
    const plan = await this.getUserPlan(userId);
    if (plan === 'FREE' && data.spreadType === 'CELTIC_CROSS') {
      throw new ForbiddenError('Spread Celtic Cross requer plano PLUS');
    }
    const cards = await this.generateSpread(data.spreadType);
    return this.repository.save({ ...data, userId, cards });
  }
}
```

### 3.4 Camada de Infraestrutura (Infrastructure)

**Responsabilidade**: Acesso a dados, integrações externas, serviços técnicos.

- **Prisma ORM** para acesso ao banco de dados
- **openai SDK** para integração com GPT-4o
- **Mercado Pago SDK** para pagamentos
- **Upstash Redis** para cache e sessões
- **Cloudflare R2** para armazenamento de imagens

```typescript
// Exemplo: Repository com Prisma
export class PrismaReadingRepository implements ReadingRepository {
  async findById(id: string): Promise<Reading | null> {
    return prisma.reading.findUnique({ where: { id }, include: { user: true } });
  }

  async findByUserId(userId: string, pagination: PaginationDTO) {
    return prisma.reading.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit,
    });
  }
}
```

---

## 4. Design Patterns

### 4.1 Repository Pattern

**Objetivo**: Abstrair o acesso a dados, desacoplando a lógica de negócio do ORM.

```
┌──────────────┐     ┌─────────────────────────┐     ┌──────────────┐
│   Service    │────▶│  ReadingRepository (I)  │────▶│   Prisma     │
│  (Domain)    │     │                         │     │  (Infra)     │
└──────────────┘     └─────────────────────────┘     └──────────────┘
```

```typescript
// Interface
interface ReadingRepository {
  findById(id: string): Promise<Reading | null>;
  findByUserId(userId: string, pagination: PaginationDTO): Promise<Reading[]>;
  save(data: CreateReadingDTO): Promise<Reading>;
  update(id: string, data: Partial<Reading>): Promise<Reading>;
  delete(id: string): Promise<void>;
}

// Implementação Prisma
class PrismaReadingRepository implements ReadingRepository { /* ... */ }
```

### 4.2 Factory Pattern

**Objetivo**: Gerar spreads de cartas com diferentes configurações.

```typescript
interface SpreadGenerator {
  generate(deck: Card[]): DrawnCard[];
}

class SpreadFactory {
  private static generators: Record<SpreadType, () => SpreadGenerator> = {
    SINGLE: () => new SingleCardGenerator(),
    THREE_CARD: () => new ThreeCardGenerator(),
    CELTIC_CROSS: () => new CelticCrossGenerator(),
    LOVE: () => new LoveSpreadGenerator(),
    YES_NO: () => new YesNoSpreadGenerator(),
    CUSTOM: (positions) => new CustomSpreadGenerator(positions),
  };

  static create(type: SpreadType): SpreadGenerator {
    return this.generators[type]();
  }
}
```

### 4.3 Strategy Pattern

**Objetivo**: Trocar provedores de IA sem alterar o código de negócio.

```typescript
interface AIProvider {
  interpretReading(cards: Card[], context: ReadingContext): AsyncGenerator<string>;
}

class GPT4oProvider implements AIProvider {
  async *interpretReading(cards: Card[], context: ReadingContext) {
    const stream = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: this.buildPrompt(cards, context),
      stream: true,
    });
    for await (const chunk of stream) {
      yield chunk.choices[0]?.delta?.content ?? '';
    }
  }
}

class ReadingInterpreter {
  constructor(private provider: AIProvider) {}

  async interpret(cards: Card[], context: ReadingContext): Promise<string> {
    let result = '';
    for await (const chunk of this.provider.interpretReading(cards, context)) {
      result += chunk;
    }
    return result;
  }
}
```

### 4.4 Observer Pattern

**Objetivo**: Notificar múltiplos interessados sobre eventos em tempo real.

```typescript
// Event Bus para comunicação entre serviços
class EventBus {
  private listeners = new Map<string, Set<Function>>();

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}

// Uso: notificação de nova leitura
const bus = new EventBus();
bus.on('reading:created', (reading) => {
  notificationService.send(reading.userId, 'Nova leitura disponível!');
  socketService.emit(reading.userId, 'reading:new', reading);
  analyticsService.track('reading_created', { id: reading.id });
});
```

### 4.5 Singleton Pattern

**Objetivo**: Garantir instância única para recursos compartilhados.

```typescriptn
// Prisma Client Singleton (evita conexões excessivas)
import { PrismaClient } from '@prisma/client';

globalThis.prisma = globalThis.prisma || new PrismaClient();

export const prisma = globalThis.prisma;

// In-memory Cache Singleton
export class InMemoryCache {
  private static instance: InMemoryCache;
  private store = new Map<string, { value: unknown; ttl: number }>();

  private constructor() {}

  static getInstance(): InMemoryCache {
    if (!InMemoryCache.instance) {
      InMemoryCache.instance = new InMemoryCache();
    }
    return InMemoryCache.instance;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.ttl) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set(key: string, value: unknown, ttlMs: number): void {
    this.store.set(key, { value, ttl: Date.now() + ttlMs });
  }
}
```

---

## 5. Princípios SOLID Aplicados

| Princípio | Aplicação no arkana-agora |
|-----------|--------------------------|
| **S** — Responsabilidade Única | Cada Service cuida de um domínio: `ReadingService`, `SocialService`, `PaymentService` |
| **O** — Aberto/Fechado | Novos spreads são adicionados via `SpreadFactory` sem modificar código existente |
| **L** — Substituição de Liskov | `AIProvider` permite trocar GPT-4o por outro modelo sem alterar `ReadingInterpreter` |
| **I** — Segregação de Interface | Repositórios específicos: `ReadingRepository`, `UserRepository`, `ProductRepository` |
| **D** — Inversão de Dependência | Services dependem de interfaces (abstrações), não de implementações concretas do Prisma |

---

## 6. Comunicação

### 6.1 REST (CRUD)

- **Protocolo**: HTTP/2, JSON
- **Uso**: Todas as operações CRUD padrão
- **Autenticação**: Custom JWT Bearer (access RS256 15min; refresh rotativo 30d) — Sprint 1 (ADR-009 Gate B), emitido após login via Auth.js v5 (ADR-010). **Implementado (Módulo 1 Auth):** `src/services/token-service.ts` + `src/lib/rate-limit.ts`.
- **Versionamento**: URI path `/api/v1/...` (futuro)

### 6.2 SSE (Server-Sent Events) — Leituras IA

- **Protocolo**: `text/event-stream`
- **Uso**: Streaming de interpretações de IA em tempo real
- **Rota implementada**: `POST /api/v1/ai/interpret` (SSE flat `token`/`done` com `interpretationId`) — `POST /api/v1/ai/reading/stream` é design legado, não existe no repo
- **Formato**:

```
data: {"token": "A carta "}

data: {"token": "O Sol indica..."}

data: [DONE]
```

**Por que SSE e não WebSocket para IA?**
- Comunicação unidirecional (servidor → cliente) é suficiente
- Reconexão automática nativa do navegador
- Mais simples de implementar e debugar
- Compatível com Server Components

### 6.3 WebSocket (Real-time Social)

- **Protocolo**: Socket.io (WebSocket com fallback de polling REST)
- **Porta**: 3003 (mini-service separado `socket-service/`, ADR-007)
- **Status**: **implementado** — Sprint 2 Phase 2.5 (T066–T075). Servidor `socket-service/src/server.ts`, emitters `socket-service/src/emitters.ts`, cliente `src/hooks/use-socket.ts`, fallback `src/app/api/v1/social/polling/`.
- **Health**: `GET /health` → `{"status":"ok"}` (qualquer outra rota fora de `/socket.io` → 404) — usado pelo healthcheck do `socket-service/Dockerfile` e pelo `webServer` do Playwright.
- **Auth no handshake**: `socket.handshake.auth.token` = access token **RS256** verificado com `JWT_PUBLIC_KEY` (`socket-service/src/auth.ts`, `jose` + `algorithms: ["RS256"]`). **Desvio documentado do plano**: o T069 pedia `JWT_SECRET`, mas o ADR-009 (nota na ADR-007) manda validar o access token custom RS256 — a mesma chave pública de `src/services/token-service.ts`. **Revogação (Crítico 5)**: o handshake também exige a claim `tokenVersion` (inteiro) e a compara com o espelho Redis `auth:tokenVersion:{userId}` (`getCachedTokenVersion` de `socket-service/src/redis-auth.ts`, mesma chave do `token-service`) — **cache miss/Redis fora é fail-open** (o container não tem Prisma; Dockerfile copia só `socket-service/`). A revogação efetiva chega por (1) **kick instantâneo**: `publishAuthKick()` no canal **`auth:kicks`** chamado por `bumpTokenVersion`/`revokeAllSessions`/`softDeleteAccount` (`src/services/token-service.ts`) → `disconnectSockets(true)` da room `user:{id}` (`socket-service/src/server.ts`); e (2) **revalidação periódica** a cada 60 s (`revalidateIntervalMs` em `socket-service/src/server.ts`) que checa `exp` + `tokenVersion` e desconecta — cobre kick perdido (Redis fora no momento do publish). Demais checagens: `maxTokenAge` = `ACCESS_TOKEN_TTL_SECONDS` (env **validada no boot** por `socket-service/src/lib/env.ts` desde a revisão R2 — antes era `process.env` cru lido em `auth.ts`; default 900 s, **tem de casar com o token-service do Next**) + 60 s, `clockTolerance` 30 s, `iss`/`aud` **não** verificados (o `token-service` não os emite; adicionar a checagem invalidaria todos os tokens vivos), chave pública cacheada por PEM (`publicKeyCache` — rotação = nova entrada). Testes: `tests/unit/socket-auth.test.ts` (revogado, cache miss fail-open, `maxTokenAge`, `clockTolerance`, reuso de KeyObject) + `tests/integration/websocket-server.test.ts` (kick desconecta o alvo e só o alvo). CORS: `origin = AUTH_URL`.
- **Rooms**: no `connection` o servidor entra sozinho em `user:{userId}` e `feed:{userId}`; joins de cliente casam apenas `^(post|comment):[A-Za-z0-9_-]+$` via `room:join`/`room:leave` com ack — `user:`/`feed:` pedidas por cliente recebem `{ok:false, error:"room_forbidden"}` (anti-spoof: só o servidor entra nessas rooms). **Acks de `room:join`** (revisão M): `{ok:true}` | `room_forbidden` (regex não casa, `user:`/`feed:` ou visibilidade negada) | `room_cap` (cap de `maxClientRooms` = 100 rooms por socket; re-join idempotente não consome vaga) | `room_error` (falha interna em `socket.join`). **Visibilidade**: antes do join o servidor chama `verifyRoomAccess` (`socket-service/src/room-access.ts`) — `GET {AUTH_URL}/api/v1/social/posts/{id}` com o Bearer do próprio socket (timeout 1500 ms): `200→true`, `401/403/404→false` (`room_forbidden`), `5xx`/rede/timeout → `null` → **fail-open** documentado; `comment:{id}` não tem endpoint de leitura hoje (T077/Phase 3) → sempre `null` (fail-open) até a API existir.
- **URL do cliente**: `NEXT_PUBLIC_WS_URL` (documentada em `docs/02-architecture/deployment.md` §2.4 e `.env.example`; validação Zod `z.string().url()` + refine `http/https/ws/wss` em `src/lib/env.ts`, resolução em `resolveSocketUrl` de `src/lib/socket-url.ts` — dev/sem var → default `http://localhost:3003`, **produção sem var → `null`** = realtime desabilitado, fallback de polling, nunca localhost (C1 da revisão multi-agente 2026-10-04); URL malformada → throw) — `src/hooks/use-socket.ts`.
- **Resiliência**: singleton com refcount, reconexão com backoff 1s→30s — incluindo **rejeição de handshake** (`CONNECT_ERROR` de namespace, que o socket.io não religa sozinho porque `destroy()` limpa os subs; o `connect_error` de **transporte** fica com o backoff do Manager — `use-socket.ts`, arquitetura C-2 da revisão multi-agente 2026-10-04; `rate_limited` espera 60 s = janela do limiter). Enquanto o socket **não** está conectado, polling a cada 30s em `GET /api/v1/social/polling/{posts,notifications}?since=` (janela inicial 5 min, amplitude máxima **24 h** — clamp `POLLING_MAX_SINCE_MS`, integridade C1; rate limit **60/min por usuário** compartilhado entre as 4 rotas de polling — revisão O, `guardPolling`; polling é suprimido assim que o socket conecta). **Cursor por endpoint** `{since, until, pending}` (`PollCursor` em `src/hooks/use-socket.ts`): página cheia (≥ `POLLING_TAKE` = 50, constante em `src/lib/social/polling-window.ts`) **trava o `since` e drena o backlog com `?until=`** antes de avançar o cursor — `resolveUntil()` de `src/app/api/v1/social/polling/polling-utils.ts` devolve **422** para data inválida (revisão I-1). O envelope devolve `serverTime` no topo e o cliente usa o **mais antigo** entre `sentAt` e `serverTime` como cursor (`pollingCursor` em `src/hooks/use-socket.ts`) — imune a skew de relógio. **Sem catch-up**: eventos emitidos enquanto o cliente estava offline não são recuperados após reconectar (pendência registrada na Phase 2.5).
- **Pendências da Phase 2.5 (2026-10-02, atualizado nas revisões)**: (1) checagem de visibilidade no `room:join` **resolvida para `post:`** na revisão M via API (acima); `comment:{id}` segue **fail-open** até o endpoint de comentário (T077, Phase 3). ~~(2) com `REDIS_URL` presente o adapter loga `missing 'error' handler on this Redis client`~~ — **resolvido na Phase 2.5 (revisão multi-agente 2026-10-04)**: handlers `error` no adapter pub/sub (`socket-service/src/server.ts`) e nos clients do singleton `src/lib/redis.ts`, cobertos por `tests/integration/websocket-adapter-env.test.ts` e `tests/unit/redis-client.test.ts`. ~~(3) polling sem rate limit~~ — **resolvido na revisão O** (limite `polling` 60/min, `docs/07-security/security.md` §Rate Limiting).

| Evento (nome canônico = `RealtimeEventMap` em `socket-service/src/emitters.ts`) | Direção | Rooms alvo | Status |
|--------|---------|------------|--------|
| `new-post` | Server → Client | `user:{id}`/`feed:{id}` dos **seguidores** do autor | **implementado** — emit em `POST /api/v1/social/posts` (T088 parcial); cliente `useFeedRealtime()` (`src/hooks/use-feed.ts`) busca o post e enfileira no pill "N novos posts" (dedup por id na fila do `useFeed`) |
| `follow-update` | Server → Client | `user:{followingId}` | **implementado** — emit em `POST /api/v1/social/follow/:userId` (T088 parcial, inclui branch de corrida pós-rollback) |
| `notification` | Server → Client | `user:{userId}` | **implementado** — badge em `src/components/social/notifications-provider.tsx` (carga inicial one-shot por polling + incremento por evento; **dedup por id** com `SEEN_IDS_CAP` = 500, revisão C) |
| `like-updated` | Server → Client | `post:{postId}` | emitters prontos; **wiring de rota pendente (T076, Phase 3)** |
| `comment-added` | Server → Client | `post:{postId}` (+ `user:{postAuthorId}` opcional) | emitters prontos; **wiring pendente (T077, Phase 3)** |
| `comment-like-updated` | Server → Client | `post:{postId}` | emitters prontos; **wiring pendente (Phase 3)** |
| `gift-received` | Server → Client | `user:{toUserId}` | emitters prontos; **wiring pendente (T120, Phase 3)** |
| `presence:update`, `reading:shared`, `chat:message` | — | — | **não existem no código** — design legado desta seção (presença/chat/leitura compartilhada estão fora do escopo entregue) |

- **Relay**: cada mensagem do Event Bus é entregue às rooms alvo em **todas** as instâncias (Redis adapter `@socket.io/redis-adapter`, só quando `REDIS_URL` está presente) e deduplicada por socket num `Set` — o cliente está em `user:{id}` **e** `feed:{id}` e não deve receber o mesmo evento duas vezes.

### 6.4 Event Bus (Inter-service)

- **Implementação (realtime)**: Redis Pub/Sub no canal **`realtime:events`** quando `REDIS_URL` está presente (dev com docker compose e produção); **EventEmitter in-process** quando não está (testes — publicador e assinante correm no mesmo processo). Fonte: `socket-service/src/bus.ts` (`publishRealtime`/`subscribeRealtime`). O mesmo bus carrega o canal de **kick de revogação** **`auth:kicks`** (`AUTH_KICK_CHANNEL`, `publishAuthKick`/`subscribeAuthKick` em `socket-service/src/bus.ts`; fluxo em §6.3 "Auth no handshake") — o sub assina os dois canais de uma vez (`sub.subscribe(REALTIME_CHANNEL, AUTH_KICK_CHANNEL)`).
- **Fluxo**: as rotas do Next chamam `emit*()` de `socket-service/src/emitters.ts` (alias `@socket/*` do `tsconfig.json`, import `@socket/src/emitters`) → `publishRealtime()` → canal → o socket-service assina e repassa para as rooms (§6.3). **Fire-and-forget**: falha de bus/DB é logada e engolida — nunca derruba a ação de negócio que disparou o emit.
- **Conexão Redis — fail-fast por chamada + auto-heal** (`socket-service/src/bus.ts`; revisões Crítico 4/K + correção de raiz do E2E T075):
  - **Fail-fast preservado no publish**: `createBusRedisClient()` configura `retryStrategy: () => null`, `enableOfflineQueue: false`, `maxRetriesPerRequest: 1` + `commandTimeout: 2000` / `connectTimeout: 3000` — **uma tentativa por chamada**, sem fila offline e sem retry de conexão embutido, para o `publishRealtime()`/`publishAuthKick()` nunca pendurar o request path das rotas. A falha vira `logger.warn` e é engolida (fire-and-forget acima).
  - **(a) Cliente morto detectado no próximo uso**: com `retryStrategy: () => null` um cliente **nunca reconecta sozinho** — depois de `ECONNRESET` (observado com Memurai local ~30 s após o boot) ele fica `status === "end" || "close"` para sempre e todo publish seguinte falharia com `Connection is closed`. `ensureRedis()` checa o estado do **pub e do sub**; morto → `discardDeadClients()` (zera `pubClient`/`subClient`/`redisReady`) → **nova tentativa na mesma chamada**. Promise rejeitada **não** fica cacheada (o `catch` limpa `redisReady`), então a próxima chamada refaz a tentativa em vez de herdar a falha antiga.
  - **(b) Reconexão automática do sub em background**: `registerSubCloseHandler(sub)` agenda `scheduleBusReconnect(sub)` nos eventos `close`/`end` do sub — backoff **1 s → 30 s** (`1000 * 2 ** failures`, cap 30 000 ms) e **máx 5 falhas consecutivas**, depois das quais o timer desiste (o próximo `publishRealtime()`/`subscribeRealtime()` ainda reconecta pelo item (a)); a flag `busShuttingDown` (limpa por `resetRealtimeBus()`) cancela o timer em shutdown/testes. É necessário porque o socket-service **não publica nada** — sem isto o sub ficaria permanentemente mudo após um ECONNRESET.
  - **Testes**: `tests/integration/realtime-bus.test.ts` — grupo `auto-recuperação de conexão morta (ECONNRESET)` (4 casos: pub morto, sub morto, `close` agenda reconexão sem publish, falha não trava o próximo publish) + grupo `fail-fast do Redis (Crítico 4)`; hooks de teste `injectBusClientsForTests()`/`busConnectAttemptsForTests()` exportados por `socket-service/src/bus.ts`.
- **Eventos de realtime publicados hoje**: `new-post`, `like-updated`, `comment-added`, `comment-like-updated`, `follow-update`, `notification`, `gift-received` (rooms em §6.3).
- **Eventos inter-services planejados** — nenhum publicador/consumidor existe no código hoje:

| Evento | Publicador | Consumidores |
|--------|------------|-------------|
| `user:registered` | AuthService | Analytics, Notification |
| `reading:created` | ReadingService | AI, Analytics, Notification |
| `payment:completed` | PaymentService | OrderService, Notification |
| `post:liked` | SocialService | Notification, Analytics |

---

## 7. Mobile — React Native via Expo

### 7.1 Estratégia

O aplicativo mobile utilizará **Expo** com **React Native**, compartilhando tipos e lógica de negócio via pacotes do monorepo.

### 7.2 Compartilhamento de Código

```
packages/types/          # Tipos compartilhados (web + mobile)
├── reading.ts           # ReadingDTO, SpreadType, Card
├── user.ts              # UserDTO, UserRole
├── social.ts            # PostDTO, CommentDTO
└── index.ts             # Barrel export

packages/api-client/     # Cliente API compartilhado
├── client.ts            # Fetch wrapper com auth
├── readings.ts          # Reading API endpoints
└── social.ts            # Social API endpoints
```

### 7.3 Diferenças Web vs Mobile

| Aspecto | Web (Next.js) | Mobile (Expo) |
|---------|---------------|---------------|
| Navegação | App Router | Expo Router |
| Renderização | SSR + CSR | Apenas CSR (nativo) |
| Estado | Zustand + TanStack Query | Zustand + TanStack Query (mesmo!) |
| UI | shadcn/ui + Tailwind | Tamagui (ou NativeWind) |
| Autenticação | Custom JWT Bearer (login via Auth.js v5) | Custom JWT Bearer + secure storage (mesmo token) |
| Push Notifications | — | Expo Notifications |
| Anim. Cartas | Framer Motion | react-native-reanimated |

---

## 8. Segurança

- **Autenticação**: Auth.js v5 (camada de login do MVP: Google OAuth + magic link, JWT strategy — ADR-010) + Custom JWT Layer (access RS256 / refresh rotativo) — Sprint 1 (ADR-009 Gate B); Facebook e e-mail/senha (credentials) também são Sprint 1. **Implementado (Módulo 1 Auth):** `POST /api/v1/auth/register` (T6), `POST /api/v1/auth/login` (T7), `POST /api/v1/auth/magic-link` (T9), `POST /api/v1/auth/magic-link/verify` (T10), `POST /api/v1/auth/forgot-password` (T11), `POST /api/v1/auth/reset-password` (T12), `POST /api/v1/auth/refresh` (T13), `POST /api/v1/auth/logout` (T14), `POST /api/v1/auth/verify-email` (T30) e `POST /api/v1/auth/verify-email/resend` (T30) com `verifyAccessToken()` (fail-closed, Redis+DB) validando `Authorization: Bearer` (substitui `getServerSession()`). **LGPD deleção de conta implementada:** `DELETE /api/v1/auth/account` (T15, soft delete atômico via `softDeleteAccount`) + `GET /api/cron/hard-delete` (T16, Vercel Cron 03:00 UTC — anonimização pós-30 dias, `src/jobs/hard-delete-accounts.ts`, protegido por `CRON_SECRET`).
- **Autorização**: RBAC por roles (USER, PROFESSIONAL, ADMIN); permissões derivadas server-side do role (não embutidas no token)
- **CSRF**: Double-submit token (cookie `csrf-token` em dev / `__Host-csrf-token` em produção + header `x-csrf-token`) nos endpoints que usam cookies (`/api/v1/auth/*`, callbacks); endpoints apenas-Bearer não exigem. **Implementado (2026-09-18; cookie client-side 2026-09-23):** `POST /api/v1/auth/register` e `POST /api/v1/auth/login` validam via `validateCsrfToken` (`src/lib/csrf`) — 403 `CSRF_TOKEN_INVALID` antes de qualquer efeito colateral; o cookie é definido **client-side** por `ensureCsrfCookie()` (`src/lib/csrf-client.ts`) em `login()`/`register()` do store imediatamente antes do POST (os forms `(auth)/login` e `(auth)/register` não o chamam mais — mount `useEffect` removido por ser redundante; nunca em RSC — `cookies().set()` ilegal no App Router). `/api/auth/*` mantém o CSRF nativo do Auth.js v5
- **Rate Limiting**: Via API Gateway (Caddy) e middleware Next.js. **Implementado (`src/lib/rate-limit.ts`):** lockout de conta (5 falhas consecutivas → 15min, `AUTH_ACCOUNT_LOCKED` retryAfter 900) + volume por IP (5/15min → 429 `AUTH_RATE_LIMITED`) + magic link 3/h por email **e** 3/h por IP (429 `AUTH_MAGIC_LINK_RATE_LIMIT`) + register 3/15min por email **e** 3/h por IP (429 `AUTH_RATE_LIMITED`) + forgot-password 3/h por email (429 `AUTH_FORGOT_RATE_LIMIT`, env `MAX_PASSWORD_RESET_PER_EMAIL`) **e** 5/h por IP (429 `AUTH_FORGOT_RATE_LIMIT`, env `MAX_PASSWORD_RESET_IP_ATTEMPTS`) + verify-email/resend 1/min por email **e** 5/h por IP (429 `AUTH_RATE_LIMITED`) + restore-account 3/h por email (429 `AUTH_RATE_LIMITED`). `POST /api/v1/auth/reset-password` (T12) **não tem rate limit próprio** — protegido pelo token single-use de 1h
- **Input Validation**: Zod schemas em todas as rotas de API
- **Content Security Policy**: Headers de segurança configurados no `next.config.ts`
- **Sanitização**: DOMPurify para conteúdo rich text de postagens

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*
