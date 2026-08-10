# API de Tarot — arkana-agora

> **Módulo**: `src/app/api/v1/tarot/` | **Autenticação**: Obrigatória (exceto baralhos e espalhamentos)

## Sumário

- [GET /tarot/decks](#get-tarotdecks)
- [GET /tarot/decks/:id](#get-tarotdecksid)
- [GET /tarot/cards](#get-tarotcards)
- [GET /tarot/spreads](#get-tarotspreads)
- [POST /tarot/draw](#post-tarotdraw)
- [GET /tarot/daily](#get-tarotdaily)
- [GET /tarot/daily/:date](#get-tarotdailydate)
- [GET /tarot/history](#get-tarothistory)
- [GET /tarot/history/:id](#get-tarothistoryid)
- [DELETE /tarot/history/:id](#delete-tarothistoryid)

---

## GET /tarot/decks

Lista baralhos disponíveis na plataforma.

### Requisição

```http
GET /api/v1/tarot/decks?type=tarot&featured=true
```

### Parâmetros de Query

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `type` | string | Todos | Filtrar: `tarot`, `lenormand` |
| `featured` | boolean | `false` | Apenas baralhos em destaque |

### Resposta — 200 OK

```json
{
  "data": [
    {
      "id": "dk_rider",
      "name": "Rider-Waite-Smith",
      "type": "tarot",
      "description": "O baralho clássico e mais conhecido mundialmente",
      "cardCount": 78,
      "language": "pt-BR",
      "featured": true,
      "coverImage": "/decks/rider/cover.jpg",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    {
      "id": "dk_lenormand_classic",
      "name": "Cartas Ciganas Clássicas",
      "type": "lenormand",
      "description": "Baralho tradicional de 36 cartas",
      "cardCount": 36,
      "language": "pt-BR",
      "featured": true,
      "coverImage": "/decks/lenormand/cover.jpg",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## GET /tarot/decks/:id

Retorna detalhes completos de um baralho.

### Requisição

```http
GET /api/v1/tarot/decks/dk_rider
```

### Resposta — 200 OK

```json
{
  "data": {
    "id": "dk_rider",
    "name": "Rider-Waite-Smith",
    "type": "tarot",
    "description": "O baralho clássico e mais conhecido mundialmente, criado por Arthur Edward Waite e ilustrado por Pamela Colman Smith em 1909.",
    "cardCount": 78,
    "suits": [
      {"id": "major", "name": "Arcanos Maiores", "count": 22},
      {"id": "wands", "name": "Paus", "count": 14},
      {"id": "cups", "name": "Copas", "count": 14},
      {"id": "swords", "name": "Espadas", "count": 14},
      {"id": "pentacles", "name": "Pentáculos", "count": 14}
    ],
    "language": "pt-BR",
    "featured": true,
    "coverImage": "/decks/rider/cover.jpg",
    "author": "A.E. Waite & P.C. Smith",
    "year": 1909,
    "isPremium": false,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `DECK_NOT_FOUND` | Baralho não encontrado |

---

## GET /tarot/cards

Lista cartas de um baralho com filtros opcionais.

### Requisição

```http
GET /api/v1/tarot/cards?deck=dk_rider&suit=major
```

### Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `deck` | string | Sim | ID do baralho |
| `suit` | string | Não | Filtrar por naipe |
| `search` | string | Não | Buscar por nome |

### Resposta — 200 OK

```json
{
  "data": [
    {
      "id": "arc_00",
      "deckId": "dk_rider",
      "name": "O Louco",
      "suit": "major",
      "number": 0,
      "keywords": ["novo início", "espontaneidade", "risco"],
      "uprightMeaning": "Novos começos, aventura, inocência, espontaneidade.",
      "reversedMeaning": "Imprudência, irresponsabilidade, falta de direção.",
      "imageUrl": "/decks/rider/cards/arc_00.jpg"
    },
    {
      "id": "arc_01",
      "deckId": "dk_rider",
      "name": "O Mago",
      "suit": "major",
      "number": 1,
      "keywords": ["habilidade", "concentração", "manifestação"],
      "uprightMeaning": "Habilidade, poder de manifestação, criatividade.",
      "reversedMeaning": "Manipulação, habilidades não utilizadas, engano.",
      "imageUrl": "/decks/rider/cards/arc_01.jpg"
    }
  ]
}
```

---

## GET /tarot/spreads

Lista espalhamentos (layouts) disponíveis.

### Requisição

```http
GET /api/v1/tarot/spreads?deckType=tarot
```

### Parâmetros de Query

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `deckType` | string | Filtrar por tipo: `tarot`, `lenormand` |

### Resposta — 200 OK

```json
{
  "data": [
    {
      "id": "spr_tres_cartas",
      "name": "Três Cartas",
      "description": "Passado, presente e futuro",
      "cardCount": 3,
      "deckType": ["tarot", "lenormand"],
      "positions": [
        {"id": 1, "name": "Passado", "description": "Influências do passado"},
        {"id": 2, "name": "Presente", "description": "Situação atual"},
        {"id": 3, "name": "Futuro", "description": "Tendências futuras"}
      ],
      "isPremium": false,
      "difficulty": "iniciante"
    },
    {
      "id": "spr_celta",
      "name": "Cruz Celta",
      "description": "Leitura completa e aprofundada com 10 posições",
      "cardCount": 10,
      "deckType": ["tarot"],
      "positions": [
        {"id": 1, "name": "Presente", "description": "Situação atual"},
        {"id": 2, "name": "Desafio", "description": "Obstáculo ou desafio"},
        {"id": 3, "name": "Fundo", "description": "Base ou fundamento"},
        {"id": 4, "name": "Passado Recente", "description": "Influências recentes"},
        {"id": 5, "name": "Melhor Resultado", "description": "O que pode dar certo"},
        {"id": 6, "name": "Futuro Próximo", "description": "Tendência imediata"},
        {"id": 7, "name": "Você", "description": "Sua postura na situação"},
        {"id": 8, "name": "Influência Externa", "description": "Outras pessoas ou fatores"},
        {"id": 9, "name": "Esperanças e Medos", "description": "Suas expectativas"},
        {"id": 10, "name": "Resultado Final", "description": "Desfecho provável"}
      ],
      "isPremium": false,
      "difficulty": "intermediario"
    },
    {
      "id": "spr_sim_nao",
      "name": "Sim ou Não",
      "description": "Resposta direta a uma pergunta específica",
      "cardCount": 3,
      "deckType": ["tarot"],
      "positions": [
        {"id": 1, "name": "Afirmativo", "description": "Tendência positiva"},
        {"id": 2, "name": "Negativo", "description": "Tendência negativa"},
        {"id": 3, "name": "Síntese", "description": "Resposta final"}
      ],
      "isPremium": false,
      "difficulty": "iniciante"
    }
  ]
}
```

---

## POST /tarot/draw

Realiza uma nova tiragem de cartas.

### Requisição

```http
POST /api/v1/tarot/draw
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "spreadType": "spr_tres_cartas",
  "deckId": "dk_rider",
  "mood": "amor",
  "question": "Como está meu relacionamento atual?",
  "isPublic": true,
  "shuffleSeed": null
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `spreadType` | string | Sim | ID de espalhamento válido |
| `deckId` | string | Não | Baralho (padrão: Rider-Waite) |
| `mood` | string | Não | `geral`, `amor`, `carreira`, `saude`, `espiritual` |
| `question` | string | Não | Pergunta do usuário (máx 300 chars) |
| `isPublic` | boolean | Não | Compartilhar no feed (padrão: `false`) |
| `shuffleSeed` | number | Não | Semente para baralho determinístico |

### Comportamento

1. Valida o espalhamento e baralho
2. Verifica rate limit de AI (se solicitada)
3. Embaralha e seleciona cartas (sem repetição)
4. Salva a tiragem no banco
5. Se `isPublic`, publica no feed social

### Resposta — 201 Created

```json
{
  "data": {
    "reading": {
      "id": "rdg_x1y2z3",
      "spreadType": "spr_tres_cartas",
      "spreadName": "Três Cartas",
      "deckId": "dk_rider",
      "mood": "amor",
      "question": "Como está meu relacionamento atual?",
      "cards": [
        {
          "position": 1,
          "positionName": "Passado",
          "cardId": "arc_06",
          "cardName": "Os Enamorados",
          "suit": "major",
          "number": 6,
          "isReversed": false,
          "imageUrl": "/decks/rider/cards/arc_06.jpg"
        },
        {
          "position": 2,
          "positionName": "Presente",
          "cardId": "arc_14",
          "cardName": "Temperança",
          "suit": "major",
          "number": 14,
          "isReversed": true,
          "imageUrl": "/decks/rider/cards/arc_14.jpg"
        },
        {
          "position": 3,
          "positionName": "Futuro",
          "cardId": "arc_19",
          "cardName": "O Sol",
          "suit": "major",
          "number": 19,
          "isReversed": false,
          "imageUrl": "/decks/rider/cards/arc_19.jpg"
        }
      ],
      "isPublic": true,
      "interpretation": null,
      "createdAt": "2025-01-15T10:30:00Z"
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `VALIDATION_ERROR` | Dados inválidos |
| 403 | `DECK_NOT_AVAILABLE` | Baralho premium requer plano Plus |
| 422 | `SPREAD_NOT_FOUND` | Espalhamento não encontrado |

---

## GET /tarot/daily

Retorna o tarot do dia para o usuário autenticado.

### Requisição

```http
GET /api/v1/tarot/daily
Authorization: Bearer <accessToken>
```

### Comportamento

- **Determinístico**: mesma data + mesmo usuário = mesma carta
- Gera com base em hash de `(userId + date)`
- Carta muda à meia-noite (UTC-3)
- Se ainda não existe, gera e salva

### Resposta — 200 OK

```json
{
  "data": {
    "date": "2025-01-15",
    "card": {
      "cardId": "arc_08",
      "cardName": "A Força",
      "suit": "major",
      "number": 8,
      "isReversed": false,
      "keywords": ["coragem", "paciência", "compaixão"],
      "uprightMeaning": "Força interior, coragem, domínio suave.",
      "imageUrl": "/decks/rider/cards/arc_08.jpg"
    },
    "message": "Hoje, a Força lhe convida a enfrentar os desafios com paciência e compaixão interior.",
    "shareUrl": "/share/daily/2025-01-15"
  }
}
```

---

## GET /tarot/daily/:date

Retorna o tarot de uma data específica.

### Requisição

```http
GET /api/v1/tarot/daily/2025-01-10
Authorization: Bearer <accessToken>
```

### Parâmetros

| Parâmetro | Tipo | Regras |
|-----------|------|--------|
| `date` | string | Formato `YYYY-MM-DD`, máximo 30 dias no passado |

### Resposta — 200 OK

Mesmo formato de `/tarot/daily` com a data solicitada.

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `VALIDATION_ERROR` | Data inválida ou fora do período |
| 404 | `DAILY_READING_NOT_FOUND` | Sem registro para essa data |

---

## GET /tarot/history

Lista o histórico de tiragens do usuário autenticado.

### Requisição

```http
GET /api/v1/tarot/history?page=1&limit=10&type=tarot
Authorization: Bearer <accessToken>
```

### Parâmetros de Query

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `page` | number | 1 | Página atual |
| `limit` | number | 10 | Itens por página (máx 50) |
| `type` | string | Todos | `tarot`, `lenormand` |
| `hasInterpretation` | boolean | — | Filtrar por tiragens com/sem interpretação IA |

### Resposta — 200 OK

```json
{
  "data": [
    {
      "id": "rdg_x1y2z3",
      "spreadType": "spr_tres_cartas",
      "spreadName": "Três Cartas",
      "mood": "amor",
      "question": "Como está meu relacionamento?",
      "cards": [
        {"position": 1, "cardId": "arc_06", "cardName": "Os Enamorados", "isReversed": false},
        {"position": 2, "cardId": "arc_14", "cardName": "Temperança", "isReversed": true},
        {"position": 3, "cardId": "arc_19", "cardName": "O Sol", "isReversed": false}
      ],
      "isPublic": true,
      "hasInterpretation": true,
      "likes": 5,
      "comments": 2,
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 42,
    "totalPages": 5
  }
}
```

---

## GET /tarot/history/:id

Retorna o detalhe completo de uma tiragem.

### Requisição

```http
GET /api/v1/tarot/history/rdg_x1y2z3
Authorization: Bearer <accessToken>
```

### Resposta — 200 OK

```json
{
  "data": {
    "id": "rdg_x1y2z3",
    "userId": "usr_a1b2c3d4",
    "spreadType": "spr_tres_cartas",
    "spreadName": "Três Cartas",
    "deckId": "dk_rider",
    "mood": "amor",
    "question": "Como está meu relacionamento?",
    "cards": [
      {
        "position": 1,
        "positionName": "Passado",
        "cardId": "arc_06",
        "cardName": "Os Enamorados",
        "suit": "major",
        "number": 6,
        "isReversed": false,
        "uprightMeaning": "Escolhas, conexões, harmonia.",
        "reversedMeaning": "Desequilíbrio, escolhas difíceis.",
        "imageUrl": "/decks/rider/cards/arc_06.jpg"
      },
      {
        "position": 2,
        "positionName": "Presente",
        "cardId": "arc_14",
        "cardName": "Temperança",
        "suit": "major",
        "number": 14,
        "isReversed": true,
        "uprightMeaning": "Equilíbrio, moderação, paciência.",
        "reversedMeaning": "Excesso, impaciência, desequilíbrio.",
        "imageUrl": "/decks/rider/cards/arc_14.jpg"
      },
      {
        "position": 3,
        "positionName": "Futuro",
        "cardId": "arc_19",
        "cardName": "O Sol",
        "suit": "major",
        "number": 19,
        "isReversed": false,
        "uprightMeaning": "Sucesso, alegria, vitalidade.",
        "reversedMeaning": "Tristeza temporária, pessimismo.",
        "imageUrl": "/decks/rider/cards/arc_19.jpg"
      }
    ],
    "interpretation": {
      "text": "Suas cartas revelam uma jornada amorosa rica em aprendizados...",
      "model": "gpt-4o",
      "tokensUsed": 1523,
      "generatedAt": "2025-01-15T10:30:05Z"
    },
    "isPublic": true,
    "likes": 5,
    "comments": 2,
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `READING_NOT_FOUND` | Tiragem não encontrada |
| 403 | `READING_ACCESS_DENIED` | Tiragem de outro usuário |

---

## DELETE /tarot/history/:id

Remove uma tiragem do histórico.

### Requisição

```http
DELETE /api/v1/tarot/history/rdg_x1y2z3
Authorization: Bearer <accessToken>
```

### Resposta — 200 OK

```json
{
  "data": {
    "message": "Tiragem removida com sucesso."
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `READING_NOT_FOUND` | Tiragem não encontrada |
| 403 | `READING_ACCESS_DENIED` | Não é dono da tiragem |