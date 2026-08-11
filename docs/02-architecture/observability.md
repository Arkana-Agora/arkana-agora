# Observabilidade — arkana-agora

> Versão: 1.0 | Última atualização: 2026-08-10

---

## 1. Visão Geral

O stack de observabilidade do arkana-agora cobre **quatro pilares**: logs, métricas, tracing e alertas. O objetivo é detectar, diagnosticar e resolver problemas rapidamente, mantendo a experiência do usuário estável.

```
┌─────────────────────────────────────────────────────────────────┐
│                    PILARES DE OBSERVABILIDADE                    │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  LOGS    │  │  MÉTRICAS│  │  TRACING │  │  ALERTAS │       │
│  │  Pino.js │  │ Vercel + │  │OpenTelem.│  │  PagerDuty│       │
│  │          │  │Prometheus│  │ (futuro) │  │  + Slack │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│       │              │                            │              │
│       ▼              ▼                            ▼              │
│  ┌──────────┐  ┌──────────┐              ┌──────────────┐       │
│  │  Sentry  │  │ Grafana  │              │  Ações:     │       │
│  │ (Errors) │  │Dashboard │              │  - Rollback │       │
│  └──────────┘  └──────────┘              │  - Scale    │       │
│                                         │  - Notify   │       │
│  ┌──────────────────┐                    └──────────────┘       │
│  │     PostHog      │                                           │
│  │ (Analytics/UX)   │                                           │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Logging

### 2.1 Pino.js

**Pino** é o logger estruturado padrão, escolhido por performance (~5x mais rápido que Winston) e saída JSON nativa.

```typescript
// src/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  redact: ['req.headers.authorization', 'req.body.password'],
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});
```

### 2.2 Níveis de Log

| Nível | Uso no arkana-agora | Exemplo |
|-------|---------------------|---------|
| `error` | Erros que requerem intervenção | Falha de pagamento, erro de IA, crash | |
| `warn` | Situações anômalas mas recuperáveis | Rate limit atingido, fallback para cache | |
| `info` | Eventos de negócio importantes | Leitura criada, novo seguidor, compra concluída | |
| `debug` | Detalhes técnicos para debug | Query SQL executada, cache hit/miss | |

### 2.3 Formato de Log

```json
{
  "level": 30,
  "time": 1720684800000,
  "msg": "Leitura criada com sucesso",
  "service": "arkana-agora",
  "module": "reading.service",
  "userId": "usr_abc123",
  "readingId": "rd_xyz789",
  "spreadType": "THREE_CARD",
  "duration_ms": 1250
}
```

### 2.4 Integração com Next.js

```typescript
// Middleware de logging para API Routes
export function withLogger(handler: Function) {
  return async (req: Request, ctx: any) => {
    const start = Date.now();
    logger.info({
      method: req.method,
      path: new URL(req.url).pathname,
      msg: 'Request iniciada',
    });

    try {
      const response = await handler(req, ctx);
      logger.info({
        method: req.method,
        path: new URL(req.url).pathname,
        status: response.status,
        duration_ms: Date.now() - start,
        msg: 'Request concluída',
      });
      return response;
    } catch (error) {
      logger.error({
        method: req.method,
        path: new URL(req.url).pathname,
        err: error,
        duration_ms: Date.now() - start,
        msg: 'Request falhou',
      });
      throw error;
    }
  };
}
```

---

## 3. Error Tracking — Sentry

### 3.1 Configuração

O Sentry captura erros tanto no **browser** (client) quanto no **servidor** (API routes, services).

```typescript
// src/lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
  tracesSampleRate: 0.1, // 10% das transações
  profilesSampleRate: 0.1, // 10% dos perfis de performance
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  replaysSessionSampleRate: 0.01, // 1% das sessões gravadas
  replaysOnErrorSampleRate: 0.1, // 10% das sessões com erro
  ignoreErrors: [
    'NetworkError',
    'AbortError',
    'Failed to fetch',
  ],
  beforeSend(event) {
    // Não enviar erros de dev
    if (process.env.NODE_ENV === 'development') return null;
    return event;
  },
});
```

### 3.2 Source Maps

Upload automático de source maps na Vercel:

```typescript
// next.config.ts
import { withSentryConfig } from '@sentry/nextjs';

export default withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
  widenClientFileUpload: true,
});
```

### 3.3 Release Tracking

Cada deploy cria um release no Sentry vinculado ao commit:

```bash
# No pipeline CI
sentry-cli releases new "$COMMIT_SHA"
sentry-cli releases set-commits "$COMMIT_SHA" --auto
sentry-cli releases finalize "$COMMIT_SHA"
```

### 3.4 Contexto do Usuário

```typescript
// Identificar usuário no Sentry
Sentry.setUser({
  id: session.user.id,
  email: session.user.email,
  plan: user.plan,
});

// Adicionar contexto de leitura
Sentry.setContext('reading', {
  id: reading.id,
  spreadType: reading.spreadType,
  cardCount: reading.cards.length,
});
```

---

## 4. Analytics — PostHog

### 4.1 Configuração

```typescript
// src/lib/analytics.ts
import posthog from 'posthog-js';

export const analytics = typeof window !== 'undefined'
  ? posthog.init(process.env.POSTHOG_KEY!, {
      api_host: 'https://us.i.posthog.com',
      capture_pageviews: true,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      person_profiles: 'identified_only',
    })
  : null;
```

### 4.2 Eventos Customizados

| Evento | Propriedades | Quando Disparado |
|--------|-------------|-----------------|
| `tarot_draw` | `spread_type`, `card_count`, `deck_type`, `mood` | Usuário tira cartas |
| `ai_reading` | `reading_id`, `spread_type`, `tokens_used`, `duration_ms` | Interpretação IA concluída |
| `arcana_calculated` | `arcanum_number`, `arcanum_name`, `method` | Arcano pessoal calculado |
| `purchase_completed` | `order_id`, `amount`, `payment_method`, `product_type` | Pagamento confirmado |
| `social_share` | `reading_id`, `platform`, `has_image` | Leitura compartilhada |
| `follow_created` | `follower_id`, `following_id`, `source` | Usuário segue outro |
| `post_created` | `has_reading`, `has_images`, `content_length` | Postagem criada |
| `plan_upgraded` | `from_plan`, `to_plan`, `payment_method` | Upgrade de plano |
| `feed_scrolled` | `depth`, `items_viewed`, `duration_ms` | Scroll no feed |
| `card_revealed` | `card_name`, `position`, `spread_type` | Carta individual revelada |

### 4.3 Funis de Conversão

```
Funil de Onboarding:
  Landing Page → Registro → Primeira Leitura → Primeira Interpretação IA

Funil de Monetização:
  Leitura Grátis → Limite Atingido → Ver Planos → Iniciar Trial → Pagamento

Funil Social:
  Criar Perfil → Primeiro Post → Primeiro Seguidor → Postagem com Leitura

Funil Marketplace:
  Navegar Produtos → Ver Produto → Adicionar ao Carrinho → Checkout → Compra
```

### 4.4 Cohorts

| Cohort | Definição | Uso |
|--------|-----------|-----|
| Usuários Ativos Semanais | Login nos últimos 7 dias | Dashboard principal |
| Leitores Frequentes | ≥ 3 leituras/semana | Feature discovery |
| Assinantes PLUS | `plan = PLUS` | Retenção, LTV |
| Criadores de Conteúdo | ≥ 5 postagens/mês | Engajamento social |
| Profissionais | `role = PROFESSIONAL` | Marketplace metrics |

---

## 5. Performance Monitoring

### 5.1 Vercel Analytics (Web Vitals)

Habilitado via `@vercel/analytics`:

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
      <Analytics />
    </html>
  );
}
```

**Métricas coletadas**:

| Métrica | Meta | Descrição |
|---------|------|-----------|
| LCP (Largest Contentful Paint) | < 2.5s | Tempo até conteúdo principal visível |
| FID (First Input Delay) | < 100ms | Tempo de resposta à primeira interação |
| CLS (Cumulative Layout Shift) | < 0.1 | Estabilidade visual |
| INP (Interaction to Next Paint) | < 200ms | Responsividade geral |
| TTFB (Time to First Byte) | < 800ms | Tempo de resposta do servidor |

### 5.2 Métricas Customizadas

```typescript
// Tempo de geração de leitura IA
analytics.capture('ai_reading', {
  duration_ms: endTime - startTime,
  tokens_used: tokenCount,
  model: 'gpt-4o',
});

// Tempo de carregamento de cartas
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    analytics.capture('card_image_loaded', {
      card_name: entry.name,
      duration_ms: entry.duration,
    });
  }
});
observer.observe({ entryTypes: ['resource'] });
```

---

## 6. Infrastructure Monitoring

### 6.1 Grafana Dashboards

**Dashboard: Visão Geral arkana-agora**

| Painel | Métricas |
|--------|----------|
| Requisições/minuto | `http_requests_total` por rota e status code |
| Latência P95 | `http_request_duration_seconds` histograma |
| Taxa de erro | `http_requests_total{status=~"5.."}` / total |
| Conexões WebSocket | `socketio_connections_active` gauge |
| Leituras IA/minuto | `ai_readings_total` counter |
| Uso de IA (tokens) | `ai_tokens_used_total` counter |
| Uptime | `up` metric (1=up, 0=down) |

### 6.2 Prometheus Metrics

Endpoints de métricas expostos via `/api/metrics`:

```typescript
// src/lib/metrics.ts
import { Counter, Histogram, Gauge } from 'prom-client';

export const metrics = {
  httpRequests: new Counter({
    name: 'http_requests_total',
    help: 'Total de requisições HTTP',
    labelNames: ['method', 'path', 'status'],
  }),

  httpRequestDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duração das requisições HTTP',
    labelNames: ['method', 'path'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),

  aiReadings: new Counter({
    name: 'ai_readings_total',
    help: 'Total de leituras IA realizadas',
    labelNames: ['spread_type', 'model'],
  }),

  aiTokensUsed: new Counter({
    name: 'ai_tokens_used_total',
    help: 'Total de tokens de IA consumidos',
    labelNames: ['model', 'type'], // type: prompt | completion
  }),

  activeWebsockets: new Gauge({
    name: 'socketio_connections_active',
    help: 'Conexões WebSocket ativas',
  }),
};
```

### 6.3 Health Check Endpoints

```typescript
// app/api/health/route.ts
import pkg from '../../package.json';
// ...
export async function GET() {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: pkg.version,
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      ai: await checkAI(),
    },
  };

  const isHealthy = Object.values(checks.services).every(s => s.status === 'ok');
  return Response.json(checks, { status: isHealthy ? 200 : 503 });
}
```

---

## 7. Alertas

### 7.1 Integração PagerDuty + Slack

```yaml
# Regras de alerta (conceitual)
alerts:
  - name: Alta taxa de erro
    condition: "error_rate > 5% por 5 minutos"
    severity: critical
    channels: [PagerDuty, Slack #incidents]
    runbook: docs/runbooks/high-error-rate.md

  - name: API de IA indisponível
    condition: "ai_error_rate > 10% por 2 minutos"
    severity: high
    channels: [Slack #ai-alerts, PagerDuty]
    runbook: docs/runbooks/ai-unavailable.md

  - name: Latência alta (P95 > 5s)
    condition: "http_request_duration_p95 > 5s por 10 minutos"
    severity: warning
    channels: [Slack #performance]

  - name: WebSocket desconectando
    condition: "websocket_disconnects > 100/min por 3 minutos"
    severity: warning
    channels: [Slack #infrastructure]

  - name: Uso de tokens IA alto
    condition: "daily_ai_tokens > 80% do orçamento"
    severity: warning
    channels: [Slack #finances]
```

### 7.2 Política de Escalonamento

```
Nível 1 (Warning)  → Slack #alerts → Equipe de on-call verifica em 30 min
Nível 2 (High)     → PagerDuty → On-call reagir em 15 min
Nível 3 (Critical) → PagerDuty + Slack + SMS → On-call reagir em 5 min
                      Se sem resposta em 15 min → Escalar para engenheiro sênior
```

---

## 8. Tracing — OpenTelemetry (Futuro)

### 8.1 Plano

Para a fase de microsserviços, será implementado **OpenTelemetry** para distributed tracing:

- **Span por requisição HTTP**: Desde o cliente até a resposta
- **Span por query de banco**: Tempo de cada query Prisma
- **Span por chamada IA**: Duração completa da interpretação GPT-4o
- **Span por evento WebSocket**: Evento emitido até entrega ao cliente
- **Context propagation**: Trace ID propagado entre web, ws-service e ai-service

### 8.2 Backends Considerados

| Backend | Prós | Contras |
|---------|------|---------|
| Jaeger | Open-source, comunidade forte | Requer infraestrutura própria |
| Tempo | Grafana nativo, bom custo | Menos features que Jaeger |
| Honeycomb | Excelente UX, query rápido | Custo pode ser alto em escala |
| Datadog | Suite completa | Custo elevado para o Brasil |

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*
