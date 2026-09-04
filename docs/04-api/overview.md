# Visão Geral da API — arkana-agora

> **Versão**: 1.0.0 | **Base URL**: `/api/v1` | **Protocolo**: REST + SSE

## Sumário

- [Base URL e Versionamento](#base-url-e-versionamento)
- [Autenticação](#autenticação)
- [Formato de Requisição/Resposta](#formato-de-requisiçãoresposta)
- [Headers Padrão](#headers-padrão)
- [Paginação](#paginação)
- [Rate Limiting](#rate-limiting)
- [Tratamento de Erros](#tratamento-de-erros)
- [Códigos de Status](#códigos-de-status)
- [OpenAPI / Swagger](#openapi--swagger)

---

## Base URL e Versionamento

Todas as rotas da API são versionadas via URI:

```
https://{dominio}/api/v1/{recurso}
```

| Ambiente | Base URL |
|----------|----------|
| Produção | `https://arkanaagora.com.br/api/v1` |
| Staging | `https://staging.arkanaagora.com.br/api/v1` |
| Desenvolvimento | `http://localhost:3000/api/v1` |

> **Estratégia**: URI versioning (`/api/v1/`, `/api/v2/`). Versões antigas são mantidas por 6 meses após descontinuação, com header `Deprecation` e `Sunset`.

---

## Autenticação

O **arkana-agora** utiliza autenticação híbrida (ADR-009; camada de login atualizada pelo ADR-010): Auth.js v5 (`next-auth@5.0.0-beta.32`, adapter Prisma mínimo, JWT strategy) como camada de login (**magic link** e **Google OAuth** — implementados no Sprint 0; **credentials** e **Facebook OAuth** no Sprint 1) + **Custom JWT Layer** para a sessão autenticada (access token RS256 de 15 min + refresh token rotativo de 30 dias — Sprint 1). **Implementado (Módulo 1 Auth):** `POST /api/v1/auth/register` (T6), `POST /api/v1/auth/login` (T7), `POST /api/v1/auth/magic-link` (T9), `POST /api/v1/auth/refresh` (T13) e `POST /api/v1/auth/logout` (T14) com `src/services/token-service.ts` (sign/verify access RS256, refresh session, rotation, bumpTokenVersion, revokeRefreshSession, revokeAllSessions), `src/lib/rate-limit.ts` (lockout de conta + volume por IP + magic link 3/h por email), `src/lib/redis.ts` (singleton), `src/lib/validators/auth.ts` (`loginSchema`/`magicLinkSchema`).

### Fluxo

```
Cliente → POST /api/v1/auth/login (ou callback OAuth/magic link via NextAuth /api/auth/*) → NextAuth confirma identidade
Servidor → Gera access_token (RS256) + refresh_token (rotação)
Cliente → Requisição com header: Authorization: Bearer <access_token>
Servidor → Valida JWT custom → Processa requisição
Cliente → POST /api/v1/auth/refresh (refresh token via cookie httpOnly) → novos access + refresh (rotação)
```

### Tipos de Autenticação

| Tipo | Uso | Header |
|------|-----|--------|
| JWT Bearer | Requisições autenticadas | `Authorization: Bearer <token>` |
| API Key | Webhooks Mercado Pago | `X-API-Key: <key>` |
| Interno | Serviço-a-serviço (WebSocket) | `X-Internal-Token: <token>` |

---

## Formato de Requisição/Resposta

### JSON (padrão)

```json
// Requisição
{
  "name": "Maria",
  "email": "maria@email.com"
}

// Resposta de sucesso
{
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

> **Nota (auth endpoints):** os endpoints de auth implementados (`POST /api/v1/auth/register`,
> `POST /api/v1/auth/login`, `POST /api/v1/auth/magic-link`, `POST /api/v1/auth/refresh`,
> `POST /api/v1/auth/logout`) retornam o
> body **plano (flat)** — `{ user, message }`, `{ accessToken, user }`, `{ message }`,
> `{ accessToken, expiresIn }` e `{ message }` respectivamente — **sem** wrapper `data`. Este é o
> contrato canônico dos endpoints de auth (ver `docs/04-api/authentication.md`). O envelope `data`
> aplica-se aos demais endpoints REST.

### SSE (Server-Sent Events — streaming de IA)

```
Content-Type: text/event-stream

id: evt_001
event: message
data: {"type": "content", "payload": {"text": "A carta do..."}}

data: {"type": "content", "payload": {"text": "Hermitano sugere..."}}

data: {"type": "done", "payload": {"tokensUsed": 1523}}
```

---

## Headers Padrão

### Requisição (enviados pelo cliente)

| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `Authorization` | Rotas autenticadas | `Bearer <jwt_token>` |
| `Content-Type` | POST/PATCH | `application/json` (padrão) |
| `X-Request-ID` | Opcional | ID único da requisição (gerado pelo cliente ou servidor) |
| `Accept-Language` | Opcional | `pt-BR` (padrão), `en-US` |
| `X-Client-Version` | Opcional | Versão do cliente (ex: `web/1.2.0`) |

### Resposta (enviados pelo servidor)

| Header | Descrição |
|--------|-----------|
| `X-Request-ID` | ID da requisição (eco do cliente ou gerado) |
| `X-RateLimit-Limit` | Limite de requisições do plano |
| `X-RateLimit-Remaining` | Requisições restantes no período |
| `X-RateLimit-Reset` | Timestamp de reset do rate limit |
| `X-Response-Time` | Tempo de processamento (ms) |

---

## Paginação

O **arkana-agora** utiliza duas estratégias de paginação conforme o contexto:

### Cursor-based (Feeds e listas ordenadas por tempo)

```json
GET /api/v1/social/feed?cursor=eyJpZCI6MTIzfQ&limit=20

{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6MTAzfQ",
    "prevCursor": "eyJpZCI6MTIzfQ",
    "hasMore": true,
    "limit": 20
  }
}
```

> **Usado em**: Feed social, notificações, histórico de tiragens.

### Offset-based (Listas paginadas simples)

```json
GET /api/v1/tarot/decks?page=2&limit=20

{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "totalItems": 85,
    "totalPages": 5
  }
}
```

> **Usado em**: Baralhos, espalhamentos, produtos do marketplace, listas admin.

---

## Rate Limiting

Limites por role/plano de usuário (fonte canônica: `docs/07-security/permissions.md`):

| Role / Plano | Requisições/min | AI Requests/dia |
|--------------|-----------------|-----------------|
| Free (USER, plano FREE) | 100 | 10 |
| Plus (USER, plano PLUS) | 300 | Ilimitado (soft limit 100/min) |
| Professional | 300 | Ilimitado |
| Admin | 600 | Ilimitado |
| Super Admin [planejado] | 600 | Ilimitado |

> Tiragens diárias: FREE = 3/dia (Tarot do Dia não conta), PLUS = 10/dia. Limites por endpoint em `permissions.md` (§ Rate Limits por Role).

### Comportamento ao exceder

```json
HTTP 429 Too Many Requests
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Limite de requisições excedido. Tente novamente em 42s.",
    "details": {
      "retryAfter": 42,
      "limit": 100,
      "remaining": 0,
      "resetAt": "2025-01-15T10:31:42Z"
    }
  }
}
```

---

## Tratamento de Erros

### Formato padrão de erro

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados de entrada inválidos.",
    "details": [
      {
        "field": "email",
        "message": "Formato de e-mail inválido",
        "code": "INVALID_FORMAT"
      }
    ]
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### Códigos de erro por domínio

| Domínio | Código | Descrição |
|---------|--------|-----------|
| Auth | `AUTH_INVALID_CREDENTIALS` | Credenciais inválidas (anti-enumeração) |
| Auth | `AUTH_EMAIL_NOT_VERIFIED` | E-mail não verificado |
| Auth | `AUTH_TOKEN_INVALID` | Token inválido ou expirado |
| Auth | `AUTH_TOKEN_REVOKED` | Token revogado (tokenVersion/flags) |
| Auth | `AUTH_ACCOUNT_LOCKED` | Conta bloqueada (5 falhas consecutivas; retryAfter 900) |
| Auth | `AUTH_RATE_LIMITED` | Limite de volume por IP (5/15min) |
| Auth | `AUTH_ACCOUNT_SUSPENDED` | Conta suspensa |
| Auth | `AUTH_EMAIL_ALREADY_EXISTS` | E-mail já cadastrado |
| Validação | `VALIDATION_ERROR` | Erro nos dados de entrada |
| Validação | `INVALID_FORMAT` | Formato inválido para um campo |
| Negócio | `INSUFFICIENT_CREDITS` | Créditos insuficientes |
| Negócio | `READING_NOT_FOUND` | Tiragem não encontrada |
| Negócio | `DECK_NOT_AVAILABLE` | Baralho não disponível |
| Rate Limit | `RATE_LIMIT_EXCEEDED` | Limite excedido |
| AI | `AI_SERVICE_UNAVAILABLE` | Serviço de IA indisponível |
| AI | `AI_DAILY_LIMIT_REACHED` | Limite diário de IA atingido |
| Sistema | `INTERNAL_ERROR` | Erro interno do servidor |
| Sistema | `SERVICE_UNAVAILABLE` | Serviço temporariamente indisponível |

---

## Códigos de Status

| Código | Significado | Quando usar |
|--------|------------|-------------|
| `200 OK` | Sucesso | Requisições GET, PATCH bem-sucedidas |
| `201 Created` | Recurso criado | POST que cria recurso (cadastro, tiragem, post) |
| `400 Bad Request` | Requisição inválida | Dados malformados, validação falhou |
| `401 Unauthorized` | Não autenticado | Token ausente, inválido ou expirado |
| `403 Forbidden` | Sem permissão | Usuário não tem acesso ao recurso |
| `404 Not Found` | Não encontrado | Recurso inexistente |
| `409 Conflict` | Conflito | E-mail já cadastrado, recurso em uso |
| `422 Unprocessable Entity` | Inprocessável | Dados válidos semanticamente incorretos |
| `429 Too Many Requests` | Rate limit | Limite de requisições excedido |
| `500 Internal Server Error` | Erro interno | Falha inesperada no servidor |
| `503 Service Unavailable` | Indisponível | Manutenção ou dependência fora do ar |

---

## OpenAPI / Swagger

### Template base (OpenAPI 3.1.0)

```yaml
openapi: 3.1.0
info:
  title: Arkana Agora API
  description: |
    Plataforma brasileira de Tarot, Cartas Ciganas (Lenormand)
    e rede social com leituras por IA.
  version: 1.0.0
  contact:
    name: Equipe Arkana Agora
    email: api@arkanaagora.com.br
  license:
    name: Proprietário

servers:
  - url: https://arkanaagora.com.br/api/v1
    description: Produção
  - url: https://staging.arkanaagora.com.br/api/v1
    description: Staging
  - url: http://localhost:3000/api/v1
    description: Desenvolvimento

tags:
  - name: Auth
    description: Autenticação e gestão de conta
  - name: Users
    description: Perfis de usuário
  - name: Tarot
    description: Baralhos, cartas e tiragens
  - name: AI
    description: Leitura por inteligência artificial
  - name: Marketplace
    description: Loja de produtos esotéricos
  - name: Social
    description: Feed, seguidores e interações
  - name: Admin
    description: Administração do sistema

paths:
  /auth/login:
    post:
      tags: [Auth]
      summary: Login com e-mail e senha
      operationId: authLogin
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email:
                  type: string
                  format: email
                  example: maria@email.com
                password:
                  type: string
                  format: password
                  minLength: 8
      responses:
        '200':
          description: Login realizado com sucesso
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Error:
      type: object
      properties:
        error:
          type: object
          properties:
            code:
              type: string
            message:
              type: string
            details:
              type: array
              items:
                type: object

    AuthResponse:
      type: object
      properties:
        data:
          type: object
          properties:
            user:
              type: object
            accessToken:
              type: string

  responses:
    Unauthorized:
      description: Não autenticado
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

security:
  - bearerAuth: []
```

> **Acesso**: Swagger UI disponível em `/api/docs` (apenas em staging e desenvolvimento).

---

## Próximos Passos

- [Autenticação](./authentication.md) — Detalhes dos endpoints de auth
- [Usuários](./users.md) — Gestão de perfis
- [Tarot](./tarot.md) — Baralhos, cartas e tiragens
- [IA](./ai.md) — Leitura por inteligência artificial
- [Marketplace](./marketplace.md) — Produtos e pedidos
- [Social](./social.md) — Feed e interações
- [Admin](./admin.md) — Painel administrativo