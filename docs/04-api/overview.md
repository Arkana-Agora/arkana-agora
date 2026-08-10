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

O **arkana-agora** utiliza NextAuth.js v4 com sessões JWT.

### Fluxo

```
Cliente → POST /auth/login → JWT (access_token + refresh_token)
Cliente → Requisição com header: Authorization: Bearer <token>
Servidor → Valida JWT → Processa requisição
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

O **arkana-agora** utiliza dois策略 de paginação conforme o contexto:

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

Limites por plano de usuário:

| Plano | Requisições/min | Requisições/dia | AI Requests/dia |
|-------|----------------|-----------------|-----------------|
| Free | 100 | 1.000 | 10 |
| Plus | 500 | 10.000 | Ilimitado |
| Admin | 1.000 | Ilimitado | Ilimitado |

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
| Auth | `AUTH_INVALID_CREDENTIALS` | Credenciais inválidas |
| Auth | `AUTH_TOKEN_EXPIRED` | Token expirado |
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
            refreshToken:
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