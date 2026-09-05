# Arquitetura do Sistema — arkana-agora

> Versão: 1.0 | Última atualização: 2026-09-02

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
│  - Pages/SSR    │ │  z-ai-sdk    │ │  - Feed updates  │
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
│   ├── ai.ts               # Cliente z-ai-web-dev-sdk
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
| `GET` | `/api/v1/feed` | Feed social do usuário |
| `POST` | `/api/v1/posts` | Criar postagem |
| `POST` | `/api/v1/follows` | Seguir usuário |
| `GET` | `/api/v1/marketplace/products` | Listar produtos |
| `POST` | `/api/v1/payments/create` | Criar pagamento |
| `POST` | `/api/v1/webhooks/mercadopago` | Webhook Mercado Pago |

> **Divisão de rotas de auth (ADR-009; camada de login atualizada pelo ADR-010):** `/api/auth/*` é reservado aos endpoints internos do Auth.js v5 (caminho fixo da biblioteca). Todas as rotas REST próprias — incluindo auth — ficam versionadas em `/api/v1/*`. `/api/v1/auth/refresh` é a rota de rotação do refresh token (Sprint 1).

### 2.3 Mini Services

Serviços complementares que rodam em portas separadas:

| Serviço | Porta | Tecnologia | Responsabilidade |
|---------|-------|------------|-----------------|
| **Socket.io Service** | 3003 | Node.js + Socket.io | Real-time: feed, notificações, presença |
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
- **Auth.js v5** (`next-auth@5.0.0-beta.32`, ADR-010) como camada de login do MVP (Google OAuth + magic link, JWT strategy) + **Custom JWT Layer** (access RS256 / refresh rotativo) como sessão autenticada da Sprint 1 (ADR-009 Gate B). **Implementado (Módulo 1 Auth):** `src/services/token-service.ts` (sign/verify access RS256, refresh session, rotation, bumpTokenVersion, revokeRefreshSession, revokeAllSessions), `src/lib/rate-limit.ts` (lockout de conta + volume por IP + magic link 3/h por email + forgot-password 3/h por email), `src/lib/redis.ts` (singleton), `src/lib/validators/auth.ts` (`loginSchema`/`magicLinkSchema`/`magicLinkVerifySchema`/`forgotPasswordSchema`/`resetPasswordSchema`/`verifyEmailSchema`/`verifyEmailResendSchema`), rotas `POST /api/v1/auth/register` (T6), `POST /api/v1/auth/login` (T7), `POST /api/v1/auth/magic-link` (T9), `POST /api/v1/auth/magic-link/verify` (T10), `POST /api/v1/auth/forgot-password` (T11), `POST /api/v1/auth/reset-password` (T12), `POST /api/v1/auth/refresh` (T13), `POST /api/v1/auth/logout` (T14), `POST /api/v1/auth/verify-email` (T30) e `POST /api/v1/auth/verify-email/resend` (T30).

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
- **z-ai-web-dev-sdk** para integração com GPT-4o
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
- **Rota**: `POST /api/v1/ai/reading/stream`
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

- **Protocolo**: Socket.io (WebSocket com fallback)
- **Porta**: 3003 (mini-service separado)
- **Eventos**:

| Evento | Direção | Descrição |
|--------|---------|-----------|
| `feed:new_post` | Server → Client | Nova postagem no feed |
| `notification:new` | Server → Client | Nova notificação |
| `presence:update` | Bidirectional | Status online/offline |
| `reading:shared` | Server → Client | Leitura compartilhada |
| `chat:message` | Bidirectional | Mensagens (futuro) |

### 6.4 Event Bus (Inter-service)

- **Implementação**: EventEmitter customizado (desenvolvimento), Redis Pub/Sub (produção)
- **Eventos**:

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
- **CSRF**: Double-submit token (`__Host-csrf-token` + header `X-Requested-With`) nos endpoints que usam cookies (`/api/v1/auth/*`, callbacks); endpoints apenas-Bearer não exigem. `/api/auth/*` mantém o CSRF nativo do Auth.js v5
- **Rate Limiting**: Via API Gateway (Caddy) e middleware Next.js. **Implementado (login + magic-link + forgot-password):** `src/lib/rate-limit.ts` — lockout de conta (5 falhas consecutivas → 15min, `AUTH_ACCOUNT_LOCKED` retryAfter 900) + volume por IP (5/15min → 429 `AUTH_RATE_LIMITED`) + magic link 3/h por email (429 `AUTH_MAGIC_LINK_RATE_LIMIT`) + forgot-password 3/h por email (429 `AUTH_FORGOT_RATE_LIMIT`, env `MAX_PASSWORD_RESET_PER_EMAIL`). `POST /api/v1/auth/reset-password` (T12) e `POST /api/v1/auth/verify-email/resend` (T30) **não têm rate limit** (decisão consciente; T27 posterior)
- **Input Validation**: Zod schemas em todas as rotas de API
- **Content Security Policy**: Headers de segurança configurados no `next.config.ts`
- **Sanitização**: DOMPurify para conteúdo rich text de postagens

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*
