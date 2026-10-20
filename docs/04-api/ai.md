# API de Inteligência Artificial — arkana-agora

> **Módulo**: `src/app/api/v1/ai/` | **SDK**: OpenAI client (`openai`) via `src/lib/ai/client.ts` | **Modelo**: GPT-4o | **Autenticação**: Obrigatória

## Sumário

- [Status das rotas](#status-das-rotas)
- [Visão Geral](#visão-geral)
- [POST /ai/interpret](#post-aiinterpret) _(implementado)_
- [POST /ai/follow-up](#post-aifollow-up) _(implementado)_
- [GET /ai/usage](#get-aiusage) _(implementado)_
- [POST /ai/arcana-interpret](#post-aiarcana-interpret) _(implementado)_
- [POST /ai/reading](#post-aireading) _(planejado)_
- [POST /ai/reading/stream](#post-aireadingstream) _(planejado)_
- [GET /ai/models](#get-aimodels) _(planejado)_
- [POST /ai/chat](#post-aichat) _(planejado)_
- [Formato SSE](#formato-sse)
- [Rate Limiting de IA](#rate-limiting-de-ia)
- [Contagem de Tokens e Custos](#contagem-de-tokens-e-custos)

---

## Status das rotas

| Rota | Status | Arquivo |
|------|--------|---------|
| `POST /api/v1/ai/interpret` | **Implementado** (SSE ou JSON em cache-hit) | `src/app/api/v1/ai/interpret/route.ts` |
| `POST /api/v1/ai/follow-up` | **Implementado** (SSE) | `src/app/api/v1/ai/follow-up/route.ts` |
| `GET /api/v1/ai/usage` | **Implementado** | `src/app/api/v1/ai/usage/route.ts` |
| `POST /api/v1/ai/arcana-interpret` | **Implementado** (SSE) | `src/app/api/v1/ai/arcana-interpret/route.ts` |
| `POST /ai/reading`, `/ai/reading/stream`, `/ai/chat`, `GET /ai/models` | **Planejados — não existem no repo** | — |

## Visão Geral

### Arquitetura de IA

```
┌──────────┐     ┌──────────────┐     ┌────────────────┐     ┌─────────┐
│  Cliente  │────>│  API Route   │────>│ Prompt Engine  │────>│ openai  │
│  (SSE)   │<────│  Next.js 16  │<────│ (templates +   │<────│ SDK     │
│          │     │              │     │  contexto)     │     │ (GPT-4o)│
└──────────┘     └──────────────┘     └────────────────┘     └─────────┘
```

### Provedor de IA (env)

O SDK é `openai` (ADR-012). O endpoint pode ser redirecionado para qualquer
API **compatível com OpenAI** via `AI_BASE_URL` (`src/lib/ai/client.ts`):

| Env | Efeito |
|-----|--------|
| `AI_API_KEY` | Obrigatória; ausente ⇒ `requireAIClient` falha ⇒ **503 `AI_SERVICE_UNAVAILABLE`** |
| `AI_BASE_URL` | Opcional. Ausente/vazio ⇒ OpenAI padrão. Definido (ex.: `https://api.z.ai/api/paas/v4`) ⇒ todas as rotas de IA usam esse endpoint |
| `AI_MODEL` / `AI_MODEL_FOLLOWUP` | Nomes de modelo enviados ao endpoint ativo |

Detalhes em [docs/05-ai/providers.md](../05-ai/providers.md#configuração-via-openai-sdk).

### Modos de Resposta

| Modo | Endpoint | Formato | Status |
|------|----------|---------|--------|
| Streaming (SSE) | `POST /ai/interpret` | SSE `token`/`done`/`error` | **Implementado** |
| Cache-hit | `POST /ai/interpret` | JSON `{ cached: true, content, interpretationId, tokensUsed: 0 }` | **Implementado** |
| Streaming (SSE) | `POST /ai/follow-up` | SSE `token`/`done` | **Implementado** |
| Non-streaming completo | `POST /ai/reading` | JSON completo | Planejado |
| Streaming legado | `POST /ai/reading/stream` | SSE | Planejado (não existe) |

---

## POST /ai/interpret _(implementado)_

Interpreta uma tiragem existente com streaming SSE.

### Requisição

```http
POST /api/v1/ai/interpret
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "readingId": "rdg_x1y2z3",
  "mode": "love",
  "mood": "reflexivo",
  "question": "O que as cartas dizem sobre meu relacionamento?"
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `readingId` | string | Sim | ID de tiragem do usuário |
| `mode` | enum | Sim | `general`, `love`, `career`, `yesno` |
| `mood` | string | Não | Máx **50 chars** (cap adicionado na review R7b, 2026-10-19; o client envia um dos moods fixos do seletor em `interpretation-request.tsx`) |
| `question` | string | Não | Máx 200 chars (útil no modo `yesno`) |

### Comportamento

1. `requireAuth` → 401 se sem Bearer
2. Busca contexto da tiragem (`getInterpretationContext`) → 404 `USER_NOT_FOUND`/`READING_NOT_FOUND`/`INTERPRETATION_NOT_FOUND`
3. **Fail-fast de IA**: `requireAIClient` (`src/app/api/v1/ai/_helpers.ts`) → **503 `AI_SERVICE_UNAVAILABLE`** se o cliente não inicializa (ex.: `AI_API_KEY` ausente) — **antes** de consumir quota
4. Rate limit diário (`checkAndIncrementDailyUsage`) → 429 `AI_DAILY_LIMIT_REACHED`
5. Monta prompt + `cacheHash` (`buildInterpretationPrompt`)
6. **Cache HIT** → responde **JSON** (não SSE): `{ cached: true, content, interpretationId, tokensUsed: 0 }`
7. **Cache MISS** → stream SSE; **persiste a interpretação antes** de emitir `done` (`persistInterpretation`); em falha, a quota é devolvida **apenas se nenhum token foi entregue** (ver §Reserva e devolução de quota)

#### Contexto enriquecido do prompt (nomes reais, nunca ids crus)

O `cacheHash` continua calculado sobre os **ids crus** (`deckId`/`spreadId`/`cardId`,
`mode`, `question`, `mood`) — preserva a invalidação de cache existente. O prompt,
porém, é montado a partir de `resolveReadingPromptContext()`
(`src/lib/ai/prompts/reading-context.ts`), que traduz esses ids para o conteúdo
editorial em `src/data/decks/*.json` + `src/data/spreads.json`:

| Campo resolvido | Origem |
|---|---|
| `deckName` / `deckDescription` | `getDeckById(deckId)` |
| `spreadName` / `spreadDescription` | `spreads.json` (id → nome + descrição) |
| `cardName` / `cardNumber` | `getDeckCards(deckId)` (id → nome + número) |
| `position` / `positionDescription` | `spread.positions[positionIndex]` |
| `meaning` | Tarô: `meaningUp` (ereta) / `meaningReversed` (invertida). Lenormand: `meaningGeneral`, ou `meaningLove`/`meaningWork` nos modos `love`/`career` |
| `keywords` | `card.keywords` (ambos os baralhos) |
| `advice` | `card.advice` (somente Tarô — Lenormand não tem campo) |

`buildUserPrompt` (`src/lib/ai/prompts/user.ts`) emite a descrição do baralho e do
espalhamento, `O que a posição significa`, `Significado`, `Palavras-chave` e
`Conselho` por carta, e inclui a **pergunta do consultante em todos os modos**
(não só no `yesno`). Ids desconhecidos caem para o próprio id / `Posicao N+1` /
string vazia — a rota nunca quebra por dado ausente.

Testes: `tests/unit/ai-reading-context.test.ts` (12) + `tests/unit/ai-prompts.test.ts` (23).

### Resposta — 200 OK (SSE)

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no

data: {"type":"token","token":"Suas cartas"}

data: {"type":"token","token":" revelam..."}

data: {"type":"done","cached":false,"interpretationId":"itr_abc123"}
```

Cache-hit (JSON):

```json
{
  "cached": true,
  "content": "Suas cartas revelam...",
  "interpretationId": "itr_abc123",
  "tokensUsed": 0
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `INVALID_BODY` | Corpo não-JSON |
| 404 | `READING_NOT_FOUND` / `INTERPRETATION_NOT_FOUND` / `USER_NOT_FOUND` | Dados ausentes |
| 422 | `VALIDATION_ERROR` | Zod: `readingId` vazio, `mode` fora do enum, `question` > 200 chars ou **`mood` > 50 chars (cap R7b — validado antes de qualquer consulta ao banco, portanto sem `details` de campo de leitura)** |
| 429 | `AI_DAILY_LIMIT_REACHED` | Limite diário atingido (free) |
| 500 | `INTERNAL_ERROR` | Falha interna |

SSE error event:

```
data: {"type":"error","code":"AI_SERVICE_UNAVAILABLE","message":"...","retryable":true}
```

---

## POST /ai/follow-up _(implementado)_

Pergunta de acompanhamento sobre uma interpretação existente (SSE).

### Requisição

```http
POST /api/v1/ai/follow-up
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "interpretationId": "itr_abc123",
  "message": "O que significa Temperança invertida no contexto amoroso?"
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `interpretationId` | string | Sim | ID da interpretação |
| `message` | string | Sim | Mensagem (1–500 chars) |

> **Sem `conversationHistory` no body** — o servidor monta o histórico via `FollowUpMessage`
> (`interpretationId` + role). O `interpretationId` para o cliente vem do `done` do interpret
> (ou do cache-hit JSON) — `ReadingAIPanel` em `src/components/ai/reading-ai-panel.tsx`.

### Resposta — 200 OK (SSE)

```
data: {"type":"token","token":"Temperança invertida..."}

data: {"type":"done"}
```

> `done` do follow-up é **flat** `{ type: "done" }` — **sem** `interpretationId`
> (diferente do interpret).

---

## GET /ai/usage _(implementado)_

Retorna uso diário de interpretações/follow-ups do usuário autenticado.

```http
GET /api/v1/ai/usage
Authorization: Bearer <accessToken>
```

---

## POST /ai/arcana-interpret _(implementado)_

Gera interpretação da arcana pessoal (SSE; `done` inclui `cached: false`).

> **Implementado** em `src/app/api/v1/ai/arcana-interpret/route.ts` (`POST`, `requireAuth`, SSE via
> `withRetry` + `getInterpretationModel()`).

### Requisição

```http
POST /api/v1/ai/arcana-interpret
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{ "arcanaNumber": 5, "mode": "general" }
```

### Validação

| Campo | Tipo | Regras |
|-------|------|--------|
| `arcanaNumber` | int | **`min(1).max(22)`** — aceita **22** ("O Louco", número mestre) |
| `mode` | enum | `general` \| `love` \| `career` \| `spiritual` — **default `general`** |

> **Range `min(0).max(21)` → `min(1).max(22)` (fix 2026-09-25).** O schema Zod `arcanaInterpretSchema` aceitava
> apenas `0–21`, então `arcanaNumber: 22` retornava **422 `VALIDATION_ERROR`** mesmo sendo um arcano
> válido — o número mestre 22 é justamente "O Louco". Agora o limite é `1–22` (o cálculo em
> `src/lib/arcana/calculate.ts` só emite `1–22`; `0` não é mais aceito em rotas novas).
>
> Resolução de número no servidor: `getArcanaByNumber(22)` (`src/data/arcana.ts`) retorna **entry 22**
> (com `roman: "XXII"`) — **não faz mais short-circuit para `ARCANA_MAP[0]`**. A chave `22` existe em
> `ARCANA_MAP` com conteúdo idêntico ao índice 0 ("O Louco"), mas o número 22 é agora a representação
> canônica do número mestre. `getArcanaByNumber(0)` ainda funciona como alias histórico (retorna
> `ARCANA_MAP[0]`), mas rotas novas usam `min(1)`.
> Um número fora de `1–22` falha no Zod → **422 `VALIDATION_ERROR`**; dentro do range mas sem carta
> correspondente → **422 `INVALID_ARCANA`**.

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `INVALID_BODY` | Corpo não-JSON |
| 401 | `AUTH_TOKEN_*` | Access token ausente, inválido ou revogado |
| 404 | `USER_NOT_FOUND` | Usuário do token não existe mais |
| 422 | `VALIDATION_ERROR` | Zod (`arcanaNumber` fora de `0–22` ou `mode` inválido) |
| 422 | `INVALID_ARCANA` | `arcanaNumber` dentro do range mas sem carta correspondente |
| 429 | `AI_DAILY_LIMIT_REACHED` | Limite diário de interpretações do plano (corpo inclui `remaining`/`totalLimit`) |
| 500 | `INTERNAL_ERROR` | Falha interna (inclui `meta.requestId`) |

### Resposta — 200 OK (SSE)

`Content-Type: text/event-stream`, formato idêntico ao de `POST /ai/interpret`
(ver §Formato SSE → *Implementado*). O prompt é montado no servidor com
`getSystemPrompt(mode)` (`src/lib/ai/prompts/system.ts`) + `buildArcanaPrompt(arcanaData, mode, user.name)`
(função **local** ao route, `src/app/api/v1/ai/arcana-interpret/route.ts`) — o cliente envia apenas
`arcanaNumber`/`mode`, nunca dados pessoais crus. A quota diária é consumida via
`checkAndIncrementDailyUsage(userId, plan)` (`src/services/ai-service.ts`) **antes** de abrir o stream.

Coberto por `tests/integration/arcana-interpret.test.ts` (caso `arcanaNumber: 22` aceito → 200 SSE).

---

## POST /ai/reading _(planejado)_

> **Não implementado.** Seção abaixo é design de produto. Use `POST /ai/interpret`.

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
5. Envia para openai SDK (GPT-4o)
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

## POST /ai/reading/stream _(planejado)_

> **Não implementado.** Seção abaixo é design de produto. O streaming implementado é
> `POST /ai/interpret` (formato SSE flat `token`/`done` — ver [Formato SSE](#formato-sse)).

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

## GET /ai/models _(planejado)_

> **Não implementado.** Não existe rota `GET /api/v1/ai/models` no repo.

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

## POST /ai/chat _(planejado)_

> **Não implementado.** O follow-up implementado é `POST /ai/follow-up` (ver acima),
> com body `{ interpretationId, message }` e SSE `token`/`done`.

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

### Implementado (`POST /ai/interpret`, `/ai/follow-up`, `/ai/arcana-interpret`)

Eventos flat (sem wrapper `payload`):

```jsonc
// Token parcial (interpret / follow-up / arcana-interpret)
{"type": "token", "token": "Suas cartas revelam..."}

// Conclusão do interpret — persistência ANTES do done; interpretationId para o painel de IA
{"type": "done", "cached": false, "interpretationId": "itr_abc123"}

// Conclusão do follow-up (sem interpretationId)
{"type": "done"}

// Erro durante geração
{"type": "error", "code": "AI_SERVICE_UNAVAILABLE", "message": "Serviço indisponível", "retryable": true}
```

Cache-hit do interpret **não** é SSE — é JSON `{ cached: true, content, interpretationId, tokensUsed: 0 }`.

### Design legado (`/ai/reading/stream` — planejado, não implementado)

#### Estrutura de um evento

```
id: <evento_id>
event: message
data: <json_serializado>
```

#### Payload por tipo

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

#### Implementação no cliente (exemplo — rota planejada)

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

### Reserva e devolução de quota

A quota é **reservada antes** de abrir o stream (`checkAndIncrementDailyUsage` /
`checkAndIncrementFollowUpUsage`), mas é **devolvida quando a geração falha
sem entregar nada** — o usuário não é cobrado por uma interpretação que não
recebeu:

- **Fail-fast**: se o cliente de IA não está inicializado (ex.: `AI_API_KEY` ausente), a rota
  responde **503 `AI_SERVICE_UNAVAILABLE`** *antes* de consumir quota (`requireAIClient`
  em `src/app/api/v1/ai/_helpers.ts`, usado nas rotas `interpret`, `arcana-interpret` e `follow-up`).
- **Devolução só sem entrega**: a rota chama `refundInterpretationQuota(userId)` /
  `refundFollowUpQuota(userId)` (`src/services/ai-service.ts` — decremento com guarda
  `gt: 0`) **apenas quando `fullText === ""`**, ou seja, nenhum token foi enfileirado
  ao cliente (falha do provedor antes do primeiro token, erro pré-stream). O
  cancelamento do cliente **depois** de tokens entregues (botão "Parar", fechar a aba,
  queda de conexão) **não devolve** a quota — devolver nesse caso seria forçável
  (POST → ler tokens → abortar → repetir) e contornaria o limite diário do plano FREE
  (review de segurança, SPRINT2-F3).
- **One-shot**: a devolução é mediada por `createQuotaReservation` (mesmo arquivo),
  que só permite **uma** devolução por requisição (evita duplo decremento se stream
  catch e outer catch dispararem juntos).
- **Follow-up compensa a mensagem**: em falha sem entrega, a rota também **remove a
  mensagem do usuário** persistida no início do stream (`followUpMessage.deleteMany`
  pelo id capturado) — sem isso, o retry duplicaria o turno no histórico.
- Rotas afetadas: `POST /ai/interpret`, `POST /ai/arcana-interpret`, `POST /ai/follow-up`.

### Fail-fast de billing (códigos não-retryable)

As três rotas de IA envolvem a chamada OpenAI através de `withRetry` (`src/lib/ai/retry.ts`,
usado nas rotas `interpret/route.ts`, `follow-up/route.ts` e `arcana-interpret/route.ts`).
Por padrão `withRetry` faz até **3 retries** com backoff exponencial (`baseDelayMs=1000` →
esperas de 1s/2s/4s). Códigos de **falha de billing/quota** da OpenAI são tratados como
**não-retryable** — retry apenas prolonga a falha:

| Código | Comportamento |
|--------|---------------|
| `credit_balance_exhausted` | Fail-fast: lança imediatamente, **sem** backoff (o retry anterior levava ~21s em retries inúteis antes de falhar) |
| `insufficient_quota` | Fail-fast: lança imediatamente, **sem** backoff |

- `extractErrorCode` (`retry.ts`) lê o código do erro OpenAI tanto do campo de **top-level** (`error.code`) quanto de um **objeto aninhado** (`error.error.code`), cobrindo as duas formas em que o SDK OpenAI pode expor o código.
- `isRetryable` também trata `TypeError` (ex.: falha de rede antes de qualquer resposta HTTP) como não-retryable e honra a flag explícita `retryable: false` quando presente no objeto de erro.
- Quando um código não-retryable é lançado, o erro propaga **imediatamente** do `withRetry` para o catch da rota (sem esperar os backoffs de 1s/2s/4s). A rota então emite o evento SSE de erro padrão — `{"type":"error","code":"AI_SERVICE_UNAVAILABLE","message":"...","retryable":true}` (código genérico hardcoded nos catches de `interpret`, `follow-up` e `arcana-interpret`; o código de billing da OpenAI **não** é exposto ao cliente). Como nenhum token foi entregue (`fullText === ""`), a quota reservada é devolvida (ver §Reserva e devolução de quota).

> Testes: `tests/unit/ai-retry.test.ts` cobre os cenários de fail-fast para `credit_balance_exhausted` e `insufficient_quota`.

### Comportamento do cliente SSE (refresh-aware + cota não consumida)

> **Implementado (2026-10-16)** — corrige "sessão parece quebrada / análise bloqueada" quando o
> access token (TTL 15min) expira entre a chamada e a resposta.

- **Fluxo via `authStreamFetch`** (`src/lib/api.ts`): o painel `ReadingAIPanel`
  (`src/components/ai/reading-ai-panel.tsx`) usa `authStreamFetch` para `POST /ai/interpret`
  e `POST /ai/follow-up` em vez de `fetch` cru com `getSession().accessToken`. Em **401**, o
  `authStreamFetch` chama o mesmo single-flight `refreshAccessTokenOnce()`
  (`src/lib/auth-refresh.ts`) do interceptor axios e **re-tenta uma vez** com o token novo —
  o usuário não precisa de logout/login. Suporta `AbortSignal` (botão "Parar" e cleanup do
  StrictMode continuam abortando a tentativa em voo).
- **Mensagem de cota não consumida**: quando o stream termina com evento `error` e
  **nenhum token** foi entregue (`receivedTokens === false` no painel), o client anexa
  *"Sua cota de interpretação não foi consumida."* à mensagem do servidor — o servidor
  devolveu a quota (ver §Reserva e devolução de quota), e sem o aviso o usuário tende a
  culpar a própria cota diária (bug reportado: "0/10 interpretações, mesmo assim bloqueado").
  Entrega parcial (tokens antes do erro) **não** recebe o aviso — a quota foi consumida.
- Testes: `tests/components/reading-ai-panel.test.tsx` — "sobrevive a access token expirado
  (401 → refresh → retry)", "falha do provedor sem tokens informa que a cota nao foi consumida",
  "entrega parcial não afirma que a cota não foi consumida".

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

Disponível em `GET /api/v1/ai/usage` (Bearer; **não** existe `GET /auth/me`):

```json
{
  "aiUsage": {
    "today": { "readings": 7, "limit": 10 },
    "month": { "readings": 89, "tokensUsed": 247000 },
    "lifetime": { "readings": 342, "tokensUsed": 980000 }
  }
}
```
