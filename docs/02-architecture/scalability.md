# Escalabilidade — arkana-agora

> Versão: 1.0 | Última atualização: 2025-07-11

---

## 1. Gargalos Identificados

| Gargalo | Impacto | Severidade | Mitigação Imediata |
|----------|---------|------------|--------------------|
| **Latência da API de IA** (GPT-4o) | Leituras demoram 5-30s | Alta | SSE streaming + cache de interpretações |
| **Conexões WebSocket** | Socket.io é stateful | Média | Redis adapter para scale horizontal |
| **Armazenamento de imagens** | Cartas de tarot são pesadas (100KB-500KB cada) | Média | CDN Cloudflare + R2 + lazy loading |
| **Queries complexas do feed** | Feed personalizado com joins múltiplos | Média | Materialized views + cache Redis |
| **Rate limiting da API de IA** | Limite de tokens por minuto | Alta | Queue com BullMQ + fallback a cache |
| **Upload de imagens** | Postagens com múltiplas imagens | Baixa | Upload direto para R2 (client-side) |

---

## 2. Estratégia de Escala Horizontal

### 2.1 Vercel (Web App)

A Vercel faz **auto-scaling** automático para Serverless Functions:

```
Requisições ──▶ Vercel Edge Network ──▶ Serverless Functions (auto-scale)
                                         │
                                         ├── 1 instância (baixo tráfego)
                                         ├── 5 instâncias (tráfego normal)
                                         └── 50+ instâncias (pico)
```

- **Cold start**: ~250ms (aceitável para a maioria das rotas)
- **Limites**: 1000 invocações/minuto (hobby), 3000 (pro)
- **Estratégia**: Rota de `/api/health` como warmup periódico

### 2.2 Railway (WebSocket + API Services)

```
Conexões WS ──▶ Railway Load Balancer ──▶ Instâncias Socket.io
                                         │
                                         ├── 1 instância (MVP)
                                         ├── 2-3 instâncias (crescimento)
                                         └── N instâncias (Redis Pub/Sub adapter)
```

- **Scale vertical**: Aumentar RAM/CPU por instância
- **Scale horizontal**: Adicionar instâncias com Redis adapter
- **Connection draining**: Graceful shutdown durante deploys

### 2.3 Neon (PostgreSQL)

O Neon oferece **serverless PostgreSQL** com scale automático:

- **Compute autoscaling**: 0.25 a 2 vCPUs baseado na carga
- **Suspensão automática**: Zero custo quando inativo (dev)
- **Branching**: Branches de banco para staging/preview
- **Point-in-time recovery**: Backup contínuo

---

## 3. Estratégia de Cache

### 3.1 Camadas de Cache

```
Requisição do Usuário
       │
       ▼
┌─────────────────┐    MISS    ┌──────────────┐    MISS    ┌──────────────┐
│  Cache L1:      │──────────▶│  Cache L2:   │──────────▶│  Cache L3:   │
│  Zustand/Store  │           │  Redis       │           │  CDN         │
│  (memória client)│          │  (Upstash)   │           │  (Cloudflare) │
│                 │◀──────────│              │◀──────────│              │
└─────────────────┘    HIT     └──────────────┘    HIT     └──────────────┘
```

### 3.2 Cache L1 — Client (Zustand/In-memory)

**Usado para**: Dados do usuário logado, preferências de UI, cartas já carregadas

```typescript
// Exemplo: Cache de cartas no Zustand store
const useCardStore = create<CardStore>((set, get) => ({
  cards: [],
  lastFetched: null,
  
  fetchCards: async (deckId: string) => {
    const { cards, lastFetched } = get();
    // Cache válido por 5 minutos
    if (cards.length > 0 && lastFetched && Date.now() - lastFetched < 300_000) {
      return cards;
    }
    const fresh = await api.getCards(deckId);
    set({ cards: fresh, lastFetched: Date.now() });
    return fresh;
  },
}));
```

### 3.3 Cache L2 — Redis (Upstash)

**Usado para**: Sessões, rate limiting, feed cache, dados quentes

```typescript
// Exemplo: Cache de feed com invalidação
async function getUserFeed(userId: string, page: number) {
  const cacheKey = `feed:${userId}:${page}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const feed = await db.post.findMany({ /* query complexa */ });
  await redis.set(cacheKey, JSON.stringify(feed), 'EX', 60); // TTL: 60s
  return feed;
}

// Invalidação: quando usuário posta
async function onNewPost(userId: string) {
  await redis.del(`feed:${userId}:*`); // Padrão de wildcard
  await redis.del('feed:global:*');
}
```

### 3.4 Cache L3 — CDN (Cloudflare)

**Usado para**: Imagens de cartas, assets estáticos, CSS/JS

| Recurso | TTL | Cache Key |
|----------|-----|-----------|
| Imagens de cartas | 30 dias | URL + `v=` hash |
| Assets do Next.js (`/_next/static`) | 365 dias | Hash do conteúdo |
| Páginas SSR públicas | 1 hora | URL + `Cache-Control` |
| API responses | Não cacheado | — |

### 3.5 Cache de Interpretações IA

Estratégia especial para o gargalo principal:

```typescript
// Cache de interpretações por combinação de cartas
async function getInterpretation(cards: Card[], spreadType: SpreadType, mood: Mood) {
  const cacheKey = `ai:${spreadType}:${cards.map(c => c.id).sort().join(',')}:${mood}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return cached; // Retorna interpretação anterior (economiza tokens IA)
  }
  
  // Se não tem cache, gera nova interpretação
  const interpretation = await aiService.interpret(cards, { spreadType, mood });
  await redis.set(cacheKey, interpretation, 'EX', 86400); // TTL: 24h
  return interpretation;
}
```

---

## 4. Escala do Banco de Dados

### 4.1 Connection Pooling (PgBouncer)

```
Aplicação (Serverless) → PgBouncer (connection pool) → Neon PostgreSQL
       │                         │                         │
  100+ conexões             Pool de 20               Max 100 conexões
  efêmeras                 conexões reais            reais
```

O Neon oferece PgBouncer gerenciado. Configuração sugerida:

```env
DATABASE_URL="postgresql://user:pass@host/db?pgbouncer=true&connect_timeout=15"
```

### 4.2 Read Replicas (Futuro)

```
                    ┌──▶ Replica (leitura) ──▶ Queries de feed, busca
Primária (escrita) ─┤
                    └──▶ Replica (leitura) ──▶ Dashboard, analytics
```

**Planejado para**: Quando leituras superarem 10K queries/minuto

### 4.3 Otimização de Queries

```typescript
// ❌ Ruim: N+1 query
const readings = await prisma.reading.findMany();
for (const r of readings) {
  r.user = await prisma.user.findUnique({ where: { id: r.userId } });
}

// ✅ Bom: Include em uma query
const readings = await prisma.reading.findMany({
  include: { user: { select: { name: true, displayName: true, avatar: true } } },
  take: 20,
});

// ✅ Melhor: Cursor-based pagination (não offset)
const readings = await prisma.reading.findMany({
  where: { userId },
  cursor: cursor ? { id: cursor } : undefined,
  take: limit + 1,
  orderBy: { createdAt: 'desc' },
});
```

---

## 5. Escala de IA

### 5.1 Fila de Requisições (BullMQ)

```
Usuário solicita leitura IA
       │
       ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  API Route   │──▶│  BullMQ      │──▶│  AI Worker   │
│  (resposta   │    │  Queue       │    │  (processa  │
│  imediata    │    │              │    │  a requisição│
│  com ID)     │    │  ┌──────────┐ │    │  sequencial) │
└──────┬───────┘    │  │ Job 1   │ │    └──────────────┘
       │            │  │ Job 2   │ │           │
       │            │  │ Job 3   │ │           ▼
       │            │  └──────────┘ │    SSE para o cliente
       │            └──────────────┘    com resultado
       │
       ▼
  Cliente recebe SSE
  com progresso em tempo real
```

### 5.2 Rate Limiting da IA

```typescript
// Rate limiter por usuário
const aiRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'ai_limit',
  points: 10,        // 10 requisições
  duration: 60,      // por minuto
  blockDuration: 300, // bloqueia por 5 min se exceder
});

// Rate limiter global (orçamento)
const globalAiLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'ai_global',
  points: 1000,      // 1000 requisições
  duration: 3600,    // por hora
});
```

### 5.3 Fallback para Cache

Quando a API de IA estiver indisponível ou rate-limited:

```typescript
async function interpretWithFallback(cards: Card[], context: ReadingContext) {
  try {
    return await aiService.interpret(cards, context);
  } catch (error) {
    if (error instanceof RateLimitError || error instanceof AIServiceUnavailable) {
      logger.warn('IA indisponível, usando cache', { error });
      const cached = await getNearestCachedInterpretation(cards);
      if (cached) {
        return {
          ...cached,
          isFromCache: true,
          notice: 'Interpretação gerada anteriormente. Tente novamente em instantes.',
        };
      }
      throw new AIServiceError('Serviço de IA temporariamente indisponível.');
    }
    throw error;
  }
}
```

---

## 6. CDN — Cloudflare

### 6.1 Estratégia de Assets

```
akashaverso.com.br
  ├── /_next/static/*          → Cache eterno (hash no nome do arquivo)
  ├── /images/cards/*.webp    → Cache 30 dias, lazy loading
  ├── /images/decks/*.webp    → Cache 30 dias, variantes responsivas
  ├── /api/*                  → Bypass (nunca cachear APIs)
  └── /*                      → Cache 1 hora (páginas públicas SSR)
```

### 6.2 Imagens de Cartas

- **Formato**: WebP (qualidade 85) — 60% menor que PNG
- **Variantes**: 3 tamanhos por carta:
  - `card-small.webp` (150x250px) — lista/miniaturas
  - `card-medium.webp` (300x500px) — feed/posts
  - `card-large.webp` (600x1000px) — leitura completa
- **Lazy loading**: `loading="lazy"` + `priority` na primeira carta visível
- **Blur placeholder**: `placeholder="blur"` com `blurDataURL` base64

```typescript
import Image from 'next/image';

<Image
  src={`/images/cards/${card.id}-medium.webp`}
  alt={card.name}
  width={300}
  height={500}
  loading="lazy"
  placeholder="blur"
  blurDataURL={card.blurDataUrl}
  sizes="(max-width: 640px) 150px, 300px"
/>
```

---

## 7. Planejamento de Capacidade

### 7.1 Estimativas por Estágio

| Recurso | 1K usuários/mês | 10K usuários/mês | 100K usuários/mês |
|---------|:---------------:|:----------------:|:-----------------:|
| **Requisições web/mês** | ~100K | ~1M | ~10M |
| **Leituras IA/mês** | ~5K | ~50K | ~500K |
| **Tokens IA/mês** | ~2.5M | ~25M | ~250M |
| **Conexões WS simultâneas** | ~20 | ~200 | ~2K |
| **Armazenamento de imagens** | 500MB | 2GB | 10GB |
| **Banco de dados** | 1GB | 10GB | 50GB |
| **Custo IA/mês** | ~$25 | ~$250 | ~$2.500 |
| **Custo infra/mês** | ~$50 | ~$150 | ~$800 |

### 7.2 Pontos de Escala

```
1K usuários (MVP)
├── Vercel Hobby (grátis) + Railway ($5)
├── Neon Free Tier
├── Upstash Free Tier
└── Instância única de tudo

▼

10K usuários (Crescimento)
├── Vercel Pro ($20) — mais serverless invocações
├── Railway Pro ($20) — 2 instâncias WS
├── Neon Pro ($19) — mais compute
├── Upstash Pay-as-you-go ($5)
└── BullMQ Worker separado

▼

100K usuários (Escala)
├── Vercel Enterprise (ou migrar para containers)
├── Railway/Render — múltiplas instâncias
├── Neon Scale — read replicas
├── Redis cluster (Upstash Pro)
├── Cloudflare R2 Pro
├── Migração para monorepo com microsserviços
└── Equipe DevOps ou plataforma gerenciada
```

### 7.3 Custos Estimados (Mensais)

| Estágio | Infraestrutura | IA (GPT-4o) | Observabilidade | **Total** |
|---------|:-------------:|:-----------:|:---------------:|:---------:|
| 1K users | $30 | $25 | $36 | **~$91** |
| 10K users | $69 | $250 | $36 | **~$355** |
| 100K users | $500 | $2,500 | $100 | **~$3,100** |

> **Nota**: Custos de IA podem ser reduzidos em 50-70% com cache agressivo e modelos menores para interpretações simples.

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*
