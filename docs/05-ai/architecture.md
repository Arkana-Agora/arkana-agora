# Arquitetura de IA — arkana-agora

> **SDK**: z-ai-web-dev-sdk | **Modelo Principal**: GPT-4o | **Streaming**: SSE via Next.js 16

## Sumário

- [Componentes](#componentes)
- [Fluxo de Leitura Completo](#fluxo-de-leitura-completo)
- [Model Router](#model-router)
- [Streaming Pipeline](#streaming-pipeline)
- [Cache Layer](#cache-layer)
- [Prompt Engine](#prompt-engine)
- [Content Filter](#content-filter)
- [Cost Tracker](#cost-tracker)
- [Fallback Strategy](#fallback-strategy)
- [Token Management](#token-management)

---

## Componentes

```
┌──────────────────────────────────────────────────────────────────┐
│                    AI SUBSYSTEM (arkana-agora)                   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐     │
│  │   Prompt     │  │    Model     │  │   Streaming        │     │
│  │   Engine     │─>│    Router    │─>│   Pipeline         │     │
│  └──────────────┘  └──────────────┘  └────────────────────┘     │
│         │                  │                   │                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐     │
│  │    Cache     │  │    Content   │  │    Cost            │     │
│  │    Layer     │  │    Filter    │  │    Tracker         │     │
│  └──────────────┘  └──────────────┘  └────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

| Componente | Responsabilidade | Tecnologia |
|------------|------------------|------------|
| **Prompt Engine** | Montar prompts com templates + dados do usuário | Handlebars + validação |
| **Model Router** | Selecionar modelo ideal por tipo de requisição | Config-driven router |
| **Streaming Pipeline** | Entregar resposta em tempo real via SSE | Next.js 16 + ReadableStream |
| **Cache Layer** | Evitar reprocessamento de leituras idênticas | Redis (24h TTL) |
| **Content Filter** | Moderar input e output da IA | Keyword detection + rules |
| **Cost Tracker** | Rastrear uso de tokens e custos | Prisma + PostgreSQL |

---

## Fluxo de Leitura Completo

```
Usuário          API Route        Prompt       Model      z-ai-web     GPT-4o
  │                │               Engine       Router     SDK           │
  │  POST /draw    │               │            │          │             │
  │───────────────>│               │            │          │             │
  │                │  1. Valida    │            │          │             │
  │                │  2. Embaralha │            │          │             │
  │                │  3. Salva     │            │          │             │
  │<───────────────│  cartas       │            │          │             │
  │   201 Created  │               │            │          │             │
  │                │               │            │          │             │
  │  POST /ai/     │               │            │          │             │
  │  reading/      │               │            │          │             │
  │  stream        │               │            │          │             │
  │───────────────>│               │            │          │             │
  │                │  4. Busca     │            │          │             │
  │                │  reading +    │            │          │             │
  │                │  user data    │            │          │             │
  │                │──────────────>│            │          │             │
  │                │               │ 5. Monta  │          │             │
  │                │               │ prompt    │          │             │
  │                │               │───────>   │          │             │
  │                │               │            │ 6. Seleciona     │
  │                │               │            │ modelo    │          │
  │                │               │            │───────>  │          │
  │                │               │            │          │ 7. Chamada │
  │                │               │            │          │ API       │
  │                │               │            │          │─────────> │
  │                │               │            │          │             │
  │                │               │            │          │ 8. Stream  │
  │                │  SSE chunks   │            │          │ <───────── │
  │<─── SSE ───────│<────────────── │<───────────│<─────────│             │
  │                │               │            │          │             │
  │                │  9. Salva     │            │          │             │
  │                │  interpretação│            │          │             │
  │                │  10. Registra │            │          │             │
  │                │  tokens       │            │          │             │
  │<─── done ──────│               │            │          │             │
```

### Detalhamento das etapas

| # | Etapa | Tempo estimado | Pode falhar? |
|---|-------|----------------|--------------|
| 1 | Validação da requisição | <10ms | Sim (400) |
| 2 | Embaralhamento e seleção | <5ms | Não |
| 3 | Salvamento da tiragem | <50ms | Sim (500) |
| 4 | Busca de dados (reading + user) | <30ms | Sim (404) |
| 5 | Montagem do prompt | <10ms | Não |
| 6 | Seleção de modelo | <1ms | Não |
| 7 | Chamada ao z-ai-web-dev-sdk | 3–8s | Sim (503) |
| 8 | Streaming da resposta | 3–8s | Sim (erro de stream) |
| 9 | Salvamento da interpretação | <50ms | Sim (500) |
| 10 | Registro de tokens | <20ms | Sim (falha silenciosa) |

---

## Model Router

Seleciona o modelo ideal com base no tipo de requisição.

```typescript
// src/lib/ai/model-router.ts

interface ModelRoute {
  feature: string
  model: string
  fallback: string
  maxTokens: number
}

const MODEL_ROUTES: ModelRoute[] = [
  {
    feature: 'reading',
    model: 'gpt-4o',
    fallback: 'gpt-4o-mini',
    maxTokens: 4096,
  },
  {
    feature: 'horoscope',
    model: 'gpt-4o-mini',
    fallback: 'gpt-4o',
    maxTokens: 1500,
  },
  {
    feature: 'yes_no',
    model: 'gpt-4o',
    fallback: 'gpt-4o-mini',
    maxTokens: 1500,
  },
  {
    feature: 'personal_arcana',
    model: 'gpt-4o',
    fallback: 'gpt-4o-mini',
    maxTokens: 2000,
  },
  {
    feature: 'chat',
    model: 'gpt-4o',
    fallback: 'gpt-4o-mini',
    maxTokens: 1000,
  },
]
```

### Estratégia de Seleção

| Critério | Peso | Descrição |
|----------|------|-----------|
| Complexidade da tarefa | 60% | Leituras completas = GPT-4o; horóscopos = mini |
| Custo | 25% | Tarefas simples usam modelos mais baratos |
| Latência | 15% | Horóscopos priorizam velocidade |

### Futuro

| Modelo | Status | Uso previsto |
|--------|--------|-------------|
| GPT-4o | ✅ Ativo | Leituras completas |
| GPT-4o-mini | ✅ Ativo | Horóscopos, respostas rápidas |
| Fine-tuned GPT-4o | 🔄 Roadmap | Leitura especializada em tarot pt-BR |
| Gemini Pro | 🔮 Futuro | Comparação de qualidade/custo |
| Claude 3 | 🔮 Futuro | Alternativa de backup |

---

## Streaming Pipeline

### Arquitetura

```
┌──────────┐     ┌──────────────┐     ┌──────────┐     ┌──────────┐
│ GPT-4o   │────>│ z-ai-web-    │────>│ Next.js  │────>│ Cliente  │
│ (stream) │     │ dev-sdk      │     │ SSE      │     │ Zustand  │
└──────────┘     └──────────────┘     │ (chunked)│     │ store    │
                                       └──────────┘     └──────────┘
                                                            │
                                                            ▼
                                                     Progressive
                                                     Rendering
```

### Implementação (Server)

```typescript
// src/app/api/v1/ai/reading/stream/route.ts

export async function POST(request: Request) {
  const { readingId, mood, question } = await request.json()

  // 1. Buscar dados e montar prompt
  const prompt = await promptEngine.build({ readingId, mood, question })

  // 2. Verificar cache
  const cacheKey = generateCacheKey(prompt)
  const cached = await cache.get(cacheKey)
  if (cached) return streamCachedResponse(cached)

  // 3. Streaming response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 4. Chamada ao z-ai-web-dev-sdk com streaming
        const aiResponse = await zAiSdk.chat.completions.create({
          model: 'gpt-4o',
          messages: prompt.messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 4096,
        })

        let fullText = ''

        for await (const chunk of aiResponse) {
          const content = chunk.choices[0]?.delta?.content || ''
          fullText += content

          // 5. Envia chunk via SSE
          const event = {
            type: 'content',
            payload: { section: 'main', text: content },
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          )
        }

        // 6. Envia evento de conclusão
        const doneEvent = {
          type: 'done',
          payload: { readingId, totalTokens: estimateTokens(fullText) },
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`)
        )

        // 7. Salva no cache e banco (fire-and-forget)
        await Promise.all([
          cache.set(cacheKey, fullText, { ttl: 86400 }),
          saveInterpretation(readingId, fullText),
          costTracker.record(readingId, prompt.tokens, fullText.length),
        ])

        controller.close()
      } catch (error) {
        const errorEvent = {
          type: 'error',
          payload: { code: 'AI_SERVICE_UNAVAILABLE', message: error.message },
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`)
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

### Implementação (Client — Zustand)

```typescript
// src/stores/reading-store.ts

interface ReadingState {
  status: 'idle' | 'streaming' | 'done' | 'error'
  sections: Record<string, string>
  fullText: string
  tokensUsed: number
  appendContent: (section: string, text: string) => void
  completeReading: (tokens: number) => void
  setError: (error: any) => void
  reset: () => void
}

export const useReadingStore = create<ReadingState>((set) => ({
  status: 'idle',
  sections: {},
  fullText: '',
  tokensUsed: 0,

  appendContent: (section, text) =>
    set((state) => ({
      status: 'streaming',
      sections: {
        ...state.sections,
        [section]: (state.sections[section] || '') + text,
      },
      fullText: state.fullText + text,
    })),

  completeReading: (tokens) =>
    set({ status: 'done', tokensUsed: tokens }),

  setError: (error) => set({ status: 'error' }),

  reset: () =>
    set({ status: 'idle', sections: {}, fullText: '', tokensUsed: 0 }),
}))
```

---

## Cache Layer

### Estratégia

| Aspecto | Detalhe |
|---------|--------|
| **Storage** | Redis |
| **Chave** | SHA-256 das cartas + data + userId + mood |
| **TTL** | 24 horas |
| **Hit Rate esperado** | 30–45% (tarot do dia, mesmas cartas) |

### Geração da Cache Key

```typescript
// src/lib/ai/cache.ts

function generateCacheKey(params: {
  readingId?: string
  cards: Card[]
  userId: string
  mood: string
  promptType: string
}): string {
  const cardHash = params.cards
    .map((c) => `${c.cardId}:${c.isReversed}`)
    .sort()
    .join('|')

  const raw = [
    params.userId,
    cardHash,
    params.mood,
    params.promptType,
    new Date().toISOString().slice(0, 10), // dia atual
  ].join('|')

  return `ai:reading:${createHash('sha256').update(raw).digest('hex')}`
}
```

### Exceções ao Cache

- Chat follow-up (sempre dinâmico)
- Leituras com `additionalContext` único
- Requisições de usuários com feedback negativo da leitura

---

## Prompt Engine

### Responsabilidades

1. **Selecionar template** com base no tipo de leitura
2. **Injetar variáveis** (cartas, usuário, contexto)
3. **Adicionar regras de moderação** ao system prompt
4. **Estimar tokens** do prompt final

### Pipeline

```
Template Base + Moderação
        │
        ▼
Template Específico (geral/amor/sim_nao)
        │
        ▼
Injeção de Variáveis (Handlebars)
        │
        ▼
Validação de Tamanho (< model max_input)
        │
        ▼
Estimativa de Tokens
        │
        ▼
Messages Array (system + user)
```

---

## Content Filter

### Pontos de Verificação

| Ponto | O que verifica |
|-------|-----------------|
| **Input Filter** | Pergunta do usuário antes de enviar à IA |
| **Output Filter** | Resposta da IA antes de enviar ao usuário |
| **System Prompt** | Regras embutidas no prompt para auto-moderação |

> Detalhes completos em [moderação](./moderation.md).

---

## Cost Tracker

### Registro por requisição

```prisma
model AiUsageLog {
  id          String   @id()
  userId      String
  readingId   String?
  feature     String   // reading, horoscope, chat, etc.
  model       String   // gpt-4o, gpt-4o-mini
  inputTokens Int
  outputTokens Int
  totalTokens Int
  costUsd     Float
  processingMs Int
  cached      Boolean  @default(false)
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])
}
```

### Agregações diárias

```sql
-- Custo diário total
SELECT
  DATE(created_at) as date,
  SUM(cost_usd) as total_cost,
  SUM(total_tokens) as total_tokens,
  COUNT(*) as requests,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END) as cache_hits
FROM ai_usage_log
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## Fallback Strategy

```
                    Requisição IA
                        │
                        ▼
               ┌────────────────┐
               │ Modelo primário │
               │    GPT-4o      │
               └───────┬────────┘
                       │
                  Sucesso?──── Sim ───> Resposta
                       │
                      Não
                       │
                       ▼
               ┌────────────────┐
               │ Modelo fallback│
               │  GPT-4o-mini   │
               └───────┬────────┘
                       │
                  Sucesso?──── Sim ───> Resposta
                       │               (com aviso)
                       │
                      Não
                       │
                       ▼
               ┌────────────────┐
               │   Cache genérico│
               │ (interpretação  │
               │  genérica salva)│
               └───────┬────────┘
                       │
                  Encontrou?── Sim ──> Resposta
                       │               (com aviso)
                       │
                      Não
                       │
                       ▼
               ┌────────────────┐
               │  Erro amigável  │
               │  "Tente         │
               │   novamente"   │
               └────────────────┘
```

### Mensagens de Fallback

| Cenário | Mensagem ao usuário |
|---------|---------------------|
| Fallback para mini | "Seu oráculo está um pouco ocupado. A leitura foi feita com um modo simplificado — peça uma nova se quiser mais detalhes." |
| Cache genérico | "As estrelas estão alinhando. Aqui está uma interpretação geral — para uma leitura personalizada, tente novamente em instantes." |
| Erro total | "O oráculo está em silêncio no momento. Por favor, tente novamente em alguns minutos." |

---

## Token Management

### Estimativa por Feature

| Feature | Input (avg) | Output (avg) | Total (avg) |
|---------|------------|--------------|-------------|
| Leitura completa (3 cartas) | 1.800 | 1.000 | 2.800 |
| Leitura completa (10 cartas) | 3.500 | 2.000 | 5.500 |
| Horóscopo diário | 500 | 300 | 800 |
| Sim/Não | 800 | 500 | 1.300 |
| Arcana pessoal | 300 | 600 | 900 |
| Chat follow-up | 600 | 200 | 800 |

### Orçamento por Usuário

| Plano | Tokens/dia | Leituras completas/dia | Custo/dia estimado |
|-------|-----------|------------------------|---------------------|
| Free | ~28.000 | 10 | $0,15 |
| Plus | Ilimitado | Ilimitado | Variável |

### Dashboard Admin

Métricas disponíveis em `GET /admin/analytics`:

- Custo total do dia/semana/mês
- Tokens por usuário (top consumers)
- Cache hit rate
- Latência média por modelo
- Error rate por provider
- Custo por feature type