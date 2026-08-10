# API de Inteligência Artificial — arkana-agora

> **Módulo**: `src/app/api/v1/ai/` | **SDK**: z-ai-web-dev-sdk | **Modelo**: GPT-4o | **Autenticação**: Obrigatória

## Sumário

- [Visão Geral](#visão-geral)
- [POST /ai/reading](#post-aireading)
- [POST /ai/reading/stream](#post-aireadingstream)
- [GET /ai/models](#get-aimodels)
- [POST /ai/interpret](#post-aiinterpret)
- [POST /ai/chat](#post-aichat)
- [Formato SSE](#formato-sse)
- [Rate Limiting de IA](#rate-limiting-de-ia)
- [Contagem de Tokens e Custos](#contagem-de-tokens-e-custos)

---

## Visão Geral

### Arquitetura de IA

```
┌──────────┐     ┌──────────────┐     ┌────────────────┐     ┌─────────┐
│  Cliente  │────>│  API Route   │────>│ Prompt Engine  │────>│ z-ai-   │
│  (SSE)   │<────│  Next.js 16  │<────│ (templates +   │<────│ web-   │
│          │     │              │     │  contexto)     │     │ dev-   │
└──────────┘     └──────────────┘     └────────────────┘     │ SDK    │
                                                               │ (GPT-  │
                                                               │  4o)   │
                                                               └─────────┘
```

### Modos de Resposta

| Modo | Endpoint | Formato | Uso |
|------|----------|---------|-----|
| Non-streaming | `POST /ai/reading` | JSON completo | APIs, webhooks, processamento em lote |
| Streaming | `POST /ai/reading/stream` | SSE (Server-Sent Events) | Interface web, UX progressiva |

---

## POST /ai/reading

Leitura completa de IA (non-streaming). Retorna a interpretação completa em JSON.

### Requisição

```http
POST /api/v1/ai/reading
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "readingId": "rdg_x1y2z3",
  "question": "Como está meu relacionamento?",
  "mood": "amor",
  "additionalContext": "Estou em dúvida se devo continuar com meu parceiro",
  "language": "pt-BR"
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `readingId` | string | Sim | ID de tiragem existente do usuário |
| `question` | string | Não | Pergunta do usuário (máx 300 chars) |
| `mood` | string | Não | `geral`, `amor`, `carreira`, `saude`, `espiritual` |
| `additionalContext` | string | Não | Contexto extra (máx 500 chars) |
| `language` | string | Não | `pt-BR` (padrão), `en-US` |

### Comportamento

1. Valida `readingId` pertence ao usuário
2. Busca cartas da tiragem no banco
3. Monta prompt via Prompt Engine
4. Verifica cache (hash das cartas + data + user)
5. Envia para z-ai-web-dev-sdk (GPT-4o)
6. Recebe resposta completa
7. Salva interpretação no banco
8. Registra uso de tokens

### Resposta — 200 OK

```json
{
  "data": {
    "readingId": "rdg_x1y2z3",
    "interpretation": {
      "summary": "Suas cartas revelam uma jornada amorosa em transição...",
      "sections": [
        {
          "position": 1,
          "positionName": "Passado",
          "cardName": "Os Enamorados",
          "isReversed": false,
          "interpretation": "No passado, Os Enamorados aparecem na posição positiva, indicando que houve uma conexão forte e uma escolha significativa que trouxe vocês juntos. A energia dessa carta sugere que o relacionamento nasceu de uma atração genuína e uma decisão consciente de estar junto."
        },
        {
          "position": 2,
          "positionName": "Presente",
          "cardName": "Temperança",
          "isReversed": true,
          "interpretation": "Temperança invertida no presente aponta para um momento de desequilíbrio. Pode haver impaciência na relação, talvez uma pressa em resolver questões que precisam de mais tempo. A comunicação pode estar excessiva ou insuficiente — o importante é encontrar o meio-termo."
        },
        {
          "position": 3,
          "positionName": "Futuro",
          "cardName": "O Sol",
          "isReversed": false,
          "interpretation": "O Sol no futuro é um excelente presságio. Indica que, se houver disposição para o diálogo e paciência com o processo, o relacionamento tem tudo para se fortalecer e trazer momentos de alegria e clareza mútua."
        }
      ],
      "advice": "O convite das cartas é para exercitar a paciência e buscar o equilíbrio nas trocas. Reserve um momento para conversar abertamente com seu parceiro sobre o que sente. O futuro é promissor, mas depende do cuidado que vocês dedicarem ao presente.",
      "affirmation": "Eu me permito viver meus relacionamentos com equilíbrio, paciência e alegria."
    },
    "meta": {
      "model": "gpt-4o",
      "inputTokens": 1847,
      "outputTokens": 1523,
      "totalTokens": 3370,
      "processingTimeMs": 4200,
      "cached": false,
      "generatedAt": "2025-01-15T10:30:05Z"
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `READING_NOT_FOUND` | Tiragem não encontrada |
| 403 | `READING_ACCESS_DENIED` | Tiragem de outro usuário |
| 429 | `AI_DAILY_LIMIT_REACHED` | Limite diário atingido (free) |
| 503 | `AI_SERVICE_UNAVAILABLE` | Serviço de IA indisponível |

---

## POST /ai/reading/stream

Leitura de IA com streaming via SSE. A interpretação é enviada em partes conforme é gerada.

### Requisição

```http
POST /api/v1/ai/reading/stream
Authorization: Bearer <accessToken>
Content-Type: application/json
Accept: text/event-stream
```

```json
{
  "readingId": "rdg_x1y2z3",
  "question": "Como está meu relacionamento?",
  "mood": "amor",
  "additionalContext": "Estou em dúvida se devo continuar",
  "language": "pt-BR"
}

```

### Validação

Mesma validação de `POST /ai/reading`.

### Resposta — 200 OK (SSE Stream)

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no

id: evt_001
event: message
data: {"type": "started", "payload": {"readingId": "rdg_x1y2z3", "model": "gpt-4o"}}

id: evt_002
event: message
data: {"type": "content", "payload": {"section": "summary", "text": "Suas cartas revelam"}}

id: evt_003
event: message
data: {"type": "content", "payload": {"section": "summary", "text": " uma jornada amorosa em transição..."}}

id: evt_004
event: message
data: {"type": "section_start", "payload": {"position": 1, "positionName": "Passado", "cardName": "Os Enamorados"}}

id: evt_005
event: message
data: {"type": "content", "payload": {"section": "position_1", "text": "No passado, Os Enamorados"}}

...

id: evt_last
event: message
data: {"type": "done", "payload": {"readingId": "rdg_x1y2z3", "totalTokens": 3370, "processingTimeMs": 5100}}

```

### Eventos SSE

| Tipo | Descrição | Payload |
|------|-----------|---------|
| `started` | Início da geração | `{readingId, model}` |
| `content` | Trecho de texto gerado | `{section, text}` |
| `section_start` | Início de nova seção | `{position, positionName, cardName}` |
| `done` | Geração concluída | `{readingId, totalTokens, processingTimeMs}` |
| `error` | Erro durante geração | `{code, message}` |

### Erros

Eventos de erro são enviados via SSE:

```
event: message
data: {"type": "error", "payload": {"code": "AI_SERVICE_UNAVAILABLE", "message": "Serviço de IA temporariamente indisponível. Tente novamente em alguns segundos."}}
```

---

## GET /ai/models

Lista modelos de IA disponíveis.

### Requisição

```http
GET /api/v1/ai/models
Authorization: Bearer <accessToken>
```

### Resposta — 200 OK

```json
{
  "data": {
    "models": [
      {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "provider": "openai",
        "description": "Modelo principal para leituras completas",
        "capabilities": ["reading", "chat", "horoscope"],
        "maxTokens": 4096,
        "costPer1kInputTokens": 0.0025,
        "costPer1kOutputTokens": 0.01,
        "isDefault": true
      },
      {
        "id": "gpt-4o-mini",
        "name": "GPT-4o-mini",
        "provider": "openai",
        "description": "Modelo leve para horóscopos e respostas rápidas",
        "capabilities": ["horoscope", "yes_no"],
        "maxTokens": 2048,
        "costPer1kInputTokens": 0.00015,
        "costPer1kOutputTokens": 0.0006,
        "isDefault": false
      }
    ]
  }
}
```

---

## POST /ai/interpret

Interpreta uma tiragem existente que ainda não possui interpretação de IA.

### Requisição

```http
POST /api/v1/ai/interpret
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "readingId": "rdg_x1y2z3",
  "mood": "geral",
  "language": "pt-BR"
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `readingId` | string | Sim | ID de tiragem sem interpretação |
| `mood` | string | Não | Tema da interpretação |
| `language` | string | Não | Idioma (padrão: `pt-BR`) |

### Comportamento

Igual a `POST /ai/reading`, mas sem `question` e `additionalContext`.

### Resposta — 200 OK

Mesmo formato de `POST /ai/reading`.

---

## POST /ai/chat

Chat de follow-up sobre uma tiragem existente.

### Requisição

```http
POST /api/v1/ai/chat
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "readingId": "rdg_x1y2z3",
  "message": "O que significa Temperança invertida no contexto amoroso?",
  "conversationId": "conv_abc123"
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `readingId` | string | Sim | ID de tiragem do usuário |
| `message` | string | Sim | Mensagem (1–500 chars) |
| `conversationId` | string | Não | ID de conversa existente (nova se omitido) |

### Comportamento

1. Carrega histórico da conversa (últimas 10 mensagens)
2. Inclui contexto da tiragem original
3. Gera resposta contextualizada
4. Salva mensagem no histórico da conversa

### Resposta — 200 OK

```json
{
  "data": {
    "conversationId": "conv_abc123",
    "message": {
      "id": "msg_xyz789",
      "role": "assistant",
      "content": "Temperança invertida no contexto amoroso sugere que pode haver um desequilíbrio emocional no relacionamento. Enquanto na posição positiva essa carta fala de harmonia e paciência, quando invertida ela indica que talvez você ou seu parceiro estejam agindo de forma impulsiva ou evitando lidar com questões importantes.",
      "readingId": "rdg_x1y2z3",
      "createdAt": "2025-01-15T10:35:00Z"
    },
    "meta": {
      "model": "gpt-4o",
      "inputTokens": 620,
      "outputTokens": 187,
      "totalTokens": 807,
      "conversationTurns": 3
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `READING_NOT_FOUND` | Tiragem não encontrada |
| 403 | `READING_ACCESS_DENIED` | Tiragem de outro usuário |
| 429 | `AI_DAILY_LIMIT_REACHED` | Limite diário atingido |

---

## Formato SSE

### Estrutura de um evento

```
id: <evento_id>
event: message
data: <json_serializado>
```

### Payload por tipo

```jsonc
// Início da geração
{"type": "started", "payload": {"readingId": "rdg_x1y2z3", "model": "gpt-4o"}}

// Conteúdo progressivo
{"type": "content", "payload": {"section": "summary", "text": "Texto parcial..."}}

// Início de seção (por carta)
{"type": "section_start", "payload": {"position": 1, "positionName": "Passado", "cardName": "Os Enamorados"}}

// Geração concluída
{"type": "done", "payload": {"readingId": "rdg_x1y2z3", "totalTokens": 3370, "processingTimeMs": 5100}}

// Erro durante geração
{"type": "error", "payload": {"code": "AI_SERVICE_UNAVAILABLE", "message": "Serviço indisponível"}}
```

### Implementação no cliente (exemplo)

```typescript
const eventSource = new EventSource('/api/v1/ai/reading/stream', {
  headers: { Authorization: `Bearer ${token}` }
})

// EventSource não suporta headers custom — usar fetch com ReadableStream:
const response = await fetch('/api/v1/ai/reading/stream', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream'
  },
  body: JSON.stringify({ readingId: 'rdg_x1y2z3', mood: 'amor' })
})

const reader = response.body!.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const chunk = decoder.decode(value)
  const lines = chunk.split('\n')

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const event = JSON.parse(line.slice(6))

      switch (event.type) {
        case 'content':
          // Anexar texto ao estado
          zustandStore.appendContent(event.payload)
          break
        case 'done':
          // Finalizar leitura
          zustandStore.completeReading(event.payload)
          break
        case 'error':
          // Tratar erro
          zustandStore.setError(event.payload)
          break
      }
    }
  }
}
```

---

## Rate Limiting de IA

| Plano | Leituras IA/dia | Chat/mês | Modelo padrão |
|-------|----------------|----------|---------------|
| Free | 10 | 50 | GPT-4o |
| Plus | Ilimitado | Ilimitado | GPT-4o |
| Admin | Ilimitado | Ilimitado | GPT-4o |

> **Reset**: Contador diário reseta à meia-noite (UTC-3). Contador mensal reseta no dia 1.

### Resposta ao exceder

```json
{
  "error": {
    "code": "AI_DAILY_LIMIT_REACHED",
    "message": "Você atingiu o limite de 10 leituras de IA por dia. Considere o plano Plus para leituras ilimitadas.",
    "details": {
      "limit": 10,
      "used": 10,
      "resetAt": "2025-01-16T03:00:00Z",
      "upgradeUrl": "/plans"
    }
  }
}
```

---

## Contagem de Tokens e Custos

### Estimativa por tipo de leitura

| Tipo | Input (tokens) | Output (tokens) | Total | Custo estimado |
|------|---------------|-----------------|-------|----------------|
| Leitura completa (3 cartas) | ~1.800 | ~1.000 | ~2.800 | $0,015 |
| Leitura completa (10 cartas) | ~3.500 | ~2.000 | ~5.500 | $0,029 |
| Horóscopo diário | ~500 | ~300 | ~800 | $0,004 |
| Sim/Não (3 cartas) | ~800 | ~500 | ~1.300 | $0,007 |
| Arcana pessoal | ~300 | ~600 | ~900 | $0,007 |
| Chat follow-up (média) | ~600 | ~200 | ~800 | $0,004 |

### Tracking por requisição

Cada resposta inclui metadados de uso:

```json
{
  "meta": {
    "model": "gpt-4o",
    "inputTokens": 1847,
    "outputTokens": 1523,
    "totalTokens": 3370,
    "processingTimeMs": 4200
  }
}
```

### Acúmulo no perfil do usuário

Disponível em `GET /auth/me`:

```json
{
  "aiUsage": {
    "today": { "readings": 7, "limit": 10 },
    "month": { "readings": 89, "tokensUsed": 247000 },
    "lifetime": { "readings": 342, "tokensUsed": 980000 }
  }
}
```
