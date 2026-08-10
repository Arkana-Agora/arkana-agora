# Definição de Entidades — arkana-agora

> Versão: 1.0 | Última atualização: 2025-07-11

---

## 1. User

Entidade principal de autenticação e identidade do usuário.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK**, default `uuidv4()` | Identificador único |
| `email` | `String` | **UQ**, **IDX**, `@email` | E-mail do usuário |
| `passwordHash` | `String?` | nullable | Hash bcrypt (nulo para OAuth) |
| `name` | `String` | NOT NULL | Nome completo (privado) |
| `displayName` | `String` | NOT NULL | Nome público no perfil |
| `avatar` | `String?` | nullable | URL do avatar (Cloudflare R2) |
| `role` | `UserRole` | NOT NULL, default `USER` | Papel no sistema |
| `plan` | `UserPlan` | NOT NULL, default `FREE` | Plano de assinatura |
| `birthDate` | `DateTime?` | nullable | Data de nascimento |
| `astrologicalSign` | `String?` | nullable | Signo do zodíaco ocidental |
| `mayanKin` | `String?` | nullable | Kin maia (Tzolkin) |
| `personalArcana` | `Int?` | nullable | Número do arcano pessoal |
| `provider` | `AuthProvider` | NOT NULL | Provedor de autenticação |
| `providerId` | `String` | NOT NULL, **UQ comp.** com provider | ID do provedor OAuth |
| `emailVerified` | `DateTime?` | nullable | Data de verificação do e-mail |
| `isActive` | `Boolean` | NOT NULL, default `true` | Conta ativa |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data de criação |
| `updatedAt` | `DateTime` | NOT NULL, `@updatedAt` | Data de atualização |

**Enums**:
- `UserRole`: `USER`, `PROFESSIONAL`, `ADMIN`
- `UserPlan`: `FREE`, `PLUS`
- `AuthProvider`: `EMAIL`, `GOOGLE`, `FACEBOOK`

---

## 2. UserProfile

Perfil público extendido do usuário (1:1 com User). Criado automaticamente no registro.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `userId` | `UUID` | **FK** → User.id, **UQ** | Usuário dono do perfil |
| `bio` | `String?` | nullable, max 500 chars | Biografia do perfil |
| `location` | `String?` | nullable | Localização (cidade/estado) |
| `website` | `String?` | nullable, `@url` | Site pessoal |
| `socialLinks` | `Json?` | nullable | Links sociais (Instagram, TikTok, YouTube) |
| `skills` | `String[]` | default `[]` | Habilidades ("Tarot", "Runas", "Astrologia") |
| `specialties` | `String[]` | default `[]` | Especialidades ("Amor", "Carreira", "Espiritual") |
| `rating` | `Decimal` | default `0.0`, min 0, max 5 | Avaliação média |
| `reviewCount` | `Int` | default `0`, min 0 | Total de avaliações recebidas |
| `pricePerReading` | `Decimal?` | nullable, min 0 | Preço por leitura (profissionais) |
| `available` | `Boolean` | default `true` | Disponível para leituras pagas |
| `languages` | `String[]` | default `["pt-BR"]` | Idiomas de atendimento |

**Exemplo de `socialLinks`**:
```json
{
  "instagram": "@tarotista_julia",
  "tiktok": "@julia.tarot",
  "youtube": "@juliacartas"
}
```

---

## 3. Reading

Registro de uma leitura de cartas realizada pelo usuário.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `userId` | `UUID` | **FK** → User.id, **IDX** | Usuário que realizou a leitura |
| `spreadType` | `SpreadType` | NOT NULL | Tipo de spread (disposição) |
| `cards` | `Json` | NOT NULL | Cartas tiradas com posições |
| `interpretation` | `String?` | nullable, max 5000 chars | Interpretação gerada pela IA |
| `mood` | `ReadingMood` | NOT NULL | Tema/energia da leitura |
| `isPublic` | `Boolean` | default `false` | Visível no perfil/feed |
| `aiModel` | `String?` | nullable | Modelo de IA utilizado |
| `tokensUsed` | `Int?` | nullable | Tokens consumidos na geração |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data da leitura |

**Enums**:
- `SpreadType`: `SINGLE`, `THREE_CARD`, `CELTIC_CROSS`, `LOVE`, `YES_NO`, `CUSTOM`
- `ReadingMood`: `GENERAL`, `LOVE`, `CAREER`, `HEALTH`, `SPIRITUAL`

**Exemplo de `cards`**:
```json
[
  {
    "cardId": "card_01",
    "position": 0,
    "positionName": "Passado",
    "isReversed": false,
    "name": "O Mago",
    "number": 1,
    "suit": "MAJOR_ARCANA"
  },
  {
    "cardId": "card_14",
    "position": 1,
    "positionName": "Presente",
    "isReversed": true,
    "name": "A Temperança",
    "number": 14,
    "suit": "MAJOR_ARCANA"
  },
  {
    "cardId": "card_21",
    "position": 2,
    "positionName": "Futuro",
    "isReversed": false,
    "name": "O Mundo",
    "number": 21,
    "suit": "MAJOR_ARCANA"
  }
]
```

---

## 4. Card

Carta individual de um baralho.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `deckId` | `UUID` | **FK** → TarotDeck.id, **IDX** | Baralho ao qual pertence |
| `name` | `String` | NOT NULL | Nome da carta ("O Mago", "Ás de Copas") |
| `number` | `Int?` | nullable | Número da carta (I a XXI, ou 1-14 para naipes) |
| `suit` | `CardSuit` | NOT NULL | Naipe ou Arcano Maior |
| `meaning_upright` | `String` | NOT NULL, max 1000 chars | Significado na posição normal |
| `meaning_reversed` | `String` | NOT NULL, max 1000 chars | Significado na posição invertida |
| `keywords` | `Json` | NOT NULL | Palavras-chave da carta |
| `imageUrl` | `String` | NOT NULL, `@url` | URL da imagem da carta |

**Enum**:
- `CardSuit`: `MAJOR_ARCANA`, `WANDS`, `CUPS`, `SWORDS`, `PENTACLES`

**Exemplo de `keywords`**:
```json
["manifestação", "criatividade", "habilidade", "concentração", "ação"]
```

---

## 5. TarotDeck

Baralho completo disponível na plataforma.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `name` | `String` | NOT NULL, **UQ** | Nome do baralho |
| `type` | `DeckType` | NOT NULL | Tipo/sistema do baralho |
| `description` | `String` | NOT NULL, max 500 chars | Descrição do baralho |
| `cardCount` | `Int` | NOT NULL, min 1 | Quantidade de cartas |
| `isActive` | `Boolean` | default `true` | Disponível para uso |

**Enum**:
- `DeckType`: `RIDER_WAITE`, `THOTH`, `LENORMAND`, `CUSTOM_MYSTIC`

**Dados de seed**:
- Rider-Waite-Smith (78 cartas): 22 Arcanos Maiores + 56 Arcanos Menores
- Baralho Cigano Lenormand (36 cartas)
- Thoth (78 cartas)

---

## 6. ArcanaCalculation

Cálculo do arcano pessoal do usuário baseado em data de nascimento e nome.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `userId` | `UUID` | **FK** → User.id, **IDX** | Usuário |
| `birthDate` | `DateTime` | NOT NULL | Data de nascimento usada |
| `fullName` | `String` | NOT NULL | Nome completo usado na redução |
| `reductionDate` | `String` | NOT NULL | Passo a passo da redução numerológica da data |
| `reductionName` | `String` | NOT NULL | Passo a passo da redução do nome |
| `arcanaNumber` | `Int` | NOT NULL, min 0, max 22 | Número do arcano (0=O Louco, 1-21) |
| `arcanaName` | `String` | NOT NULL | Nome do arcano |
| `description` | `String` | NOT NULL, max 2000 chars | Descrição interpretativa do arcano |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data do cálculo |

---

## 7. HoroscopeEntry

Entrada de horóscopo para o usuário.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `userId` | `UUID` | **FK** → User.id, **IDX** | Usuário |
| `type` | `HoroscopeType` | NOT NULL | Tipo do horóscopo |
| `zodiacSign` | `String?` | nullable | Signo do zodíaco ocidental |
| `chineseAnimal` | `String?` | nullable | Animal do zodíaco chinês |
| `mayanKin` | `String?` | nullable | Kin do calendário maia |
| `content` | `Json` | NOT NULL | Conteúdo do horóscopo estruturado |
| `sourceDate` | `DateTime` | NOT NULL | Data a que o horóscopo se refere |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data de geração |

**Enum**:
- `HoroscopeType`: `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`

**Exemplo de `content`**:
```json
{
  "general": "Um dia de transformações positivas...",
  "love": "No amor, a comunicação será fundamental...",
  "career": "Profissionalmente, novas oportunidades surgem...",
  "health": "Cuide da saúde mental com meditação...",
  "lucky_number": 7,
  "lucky_color": "Azul escuro"
}
```

---

## 8. Spread

Template de disposição de cartas (spread).

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `name` | `String` | NOT NULL | Nome do spread ("Tire 3 Cartas") |
| `cardCount` | `Int` | NOT NULL, min 1, max 22 | Número de cartas |
| `positions` | `Json` | NOT NULL | Definição das posições |
| `description` | `String` | NOT NULL, max 500 chars | Descrição do spread |
| `isPremium` | `Boolean` | default `false` | Requer plano PLUS |
| `category` | `SpreadCategory` | NOT NULL | Categoria do spread |

**Enum**:
- `SpreadCategory`: `GENERAL`, `LOVE`, `CAREER`, `SPIRITUAL`, `CUSTOM`

**Exemplo de `positions`** (Three Card):
```json
[
  { "index": 0, "name": "Passado", "description": "Influências do passado" },
  { "index": 1, "name": "Presente", "description": "Situação atual" },
  { "index": 2, "name": "Futuro", "description": "Tendências futuras" }
]
```

**Exemplo de `positions`** (Celtic Cross):
```json
[
  { "index": 0, "name": "Presente", "description": "A situação atual" },
  { "index": 1, "name": "Desafio", "description": "O obstáculo ou desafio" },
  { "index": 2, "name": "Fundamento", "description": "A base da questão" },
  { "index": 3, "name": "Passado Recente", "description": "O que está passando" },
  { "index": 4, "name": "Melhor Caminho", "description": "A meta ou crown" },
  { "index": 5, "name": "Futuro Próximo", "description": "O que está por vir" },
  { "index": 6, "name": "Consciência", "description": "Sua perspectiva" },
  { "index": 7, "name": "Influência Externa", "description": "Como outros veem" },
  { "index": 8, "name": "Esperanças e Medos", "description": "Seus desejos" },
  { "index": 9, "name": "Resultado Final", "description": "A conclusão" }
]
```

---

## 9. Follow

Relação de seguir entre usuários (N:M via tabela juntura).

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `followerId` | `UUID` | **FK** → User.id, **IDX** | Quem segue |
| `followingId` | `UUID` | **FK** → User.id, **IDX** | Quem é seguido |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data do seguimento |

**Restrição Única**: `@@unique([followerId, followingId])` — impede seguir duas vezes.

**Restrição de Negócio**: `followerId` ≠ `followingId` (não pode seguir a si mesmo) — validado na camada de aplicação.

---

## 10. Post

Postagem do feed social, opcionalmente vinculada a uma leitura.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `authorId` | `UUID` | **FK** → User.id, **IDX** | Autor da postagem |
| `readingId` | `UUID?` | **FK** → Reading.id, nullable, **IDX** | Leitura compartilhada (opcional) |
| `content` | `String` | NOT NULL, min 1, max 2000 chars | Texto da postagem |
| `images` | `Json?` | nullable | URLs das imagens anexadas |
| `likesCount` | `Int` | NOT NULL, default `0`, min 0 | Contador de curtidas (denormalizado) |
| `commentsCount` | `Int` | NOT NULL, default `0`, min 0 | Contador de comentários (denormalizado) |
| `isPublic` | `Boolean` | default `true` | Visível para todos |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data de criação |
| `updatedAt` | `DateTime` | NOT NULL, `@updatedAt` | Data de atualização |

**Exemplo de `images`**:
```json
["https://assets.akashaverso.com.br/posts/img_abc123.webp"]
```

---

## 11. Comment

Comentário em uma postagem.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `postId` | `UUID` | **FK** → Post.id, **IDX**, `onDelete CASCADE` | Postagem comentada |
| `authorId` | `UUID` | **FK** → User.id, **IDX** | Autor do comentário |
| `content` | `String` | NOT NULL, min 1, max 1000 chars | Texto do comentário |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data de criação |
| `updatedAt` | `DateTime` | NOT NULL, `@updatedAt` | Data de edição |

---

## 12. Product

Produto do marketplace (leitura paga, curso, produto físico esotérico).

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `sellerId` | `UUID` | **FK** → User.id, **IDX** | Vendedor (profissional) |
| `name` | `String` | NOT NULL, **IDX**, **FTS** | Nome do produto |
| `description` | `String` | NOT NULL, **FTS** | Descrição detalhada |
| `price` | `Decimal` | NOT NULL, min 0 | Preço em BRL |
| `category` | `String` | NOT NULL, **IDX** | Categoria do produto |
| `images` | `Json` | NOT NULL, default `[]` | URLs das imagens do produto |
| `isActive` | `Boolean` | default `true` | Produto ativo/visível |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data de criação |

**Categorias**: `"leitura_online"`, `"leitura_presencial"`, `"curso"`, `"cartas"`, `"cristais"`, `"incensos"`, `"outros"`

---

## 13. Order

Pedido de compra no marketplace.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `buyerId` | `UUID` | **FK** → User.id, **IDX** | Comprador |
| `productId` | `UUID` | **FK** → Product.id, **IDX** | Produto comprado |
| `amount` | `Decimal` | NOT NULL, min 0 | Valor total em BRL |
| `status` | `OrderStatus` | NOT NULL, default `PENDING` | Status do pedido |
| `paymentId` | `UUID?` | **FK** → Payment.id, nullable | Pagamento associado |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data do pedido |
| `updatedAt` | `DateTime` | NOT NULL, `@updatedAt` | Data de atualização |

**Enum**:
- `OrderStatus`: `PENDING`, `PAID`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `DISPUTED`

---

## 14. Payment

Registro de pagamento processado via Mercado Pago.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `userId` | `UUID` | **FK** → User.id, **IDX** | Usuário que pagou |
| `orderId` | `UUID?` | **FK** → Order.id, nullable, **IDX** | Pedido associado (opcional) |
| `amount` | `Decimal` | NOT NULL, min 0 | Valor em BRL |
| `method` | `PaymentMethod` | NOT NULL | Método de pagamento |
| `status` | `PaymentStatus` | NOT NULL, default `PENDING` | Status do pagamento |
| `externalId` | `String?` | nullable, **UQ** | ID externo no Mercado Pago |
| `metadata` | `Json?` | nullable | Dados adicionais do gateway |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data do pagamento |

**Enums**:
- `PaymentMethod`: `MERCADO_PAGO`, `CREDIT_CARD`, `PIX`
- `PaymentStatus`: `PENDING`, `APPROVED`, `REJECTED`, `REFUNDED`, `CANCELLED`

**Exemplo de `metadata`**:
```json
{
  "mp_payment_id": 123456789,
  "mp_preference_id": "pref_abc123",
  "mp_payment_type": "credit_card",
  "mp_installments": 3,
  "mp_card_last_four": "4242",
  "mp_payer_email": "comprador@email.com"
}
```

---

## 15. Gift

Presente virtual enviado entre usuários.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `senderId` | `UUID` | **FK** → User.id, **IDX** | Quem envia o presente |
| `receiverId` | `UUID` | **FK** → User.id, **IDX** | Quem recebe o presente |
| `giftType` | `String` | NOT NULL | Tipo de presente |
| `message` | `String?` | nullable, max 280 chars | Mensagem personalizada |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data do envio |

**Tipos de presente**: `"tarot_card"`, `"crystal"`, `"candle"`, `"star"`, `"heart"`, `"custom"`

---

## 16. Notification

Notificação para o usuário.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `userId` | `UUID` | **FK** → User.id, **IDX** | Destinatário |
| `type` | `NotificationType` | NOT NULL | Tipo da notificação |
| `title` | `String` | NOT NULL, max 100 chars | Título da notificação |
| `body` | `String` | NOT NULL, max 300 chars | Corpo da notificação |
| `data` | `Json?` | nullable | Dados estruturados adicionais |
| `isRead` | `Boolean` | NOT NULL, default `false`, **IDX parcial** | Se foi lida |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data de criação |

**Enum**:
- `NotificationType`: `LIKE`, `COMMENT`, `FOLLOW`, `GIFT`, `PAYMENT`, `READING`, `SYSTEM`

**Exemplo de `data`**:
```json
{
  "postId": "post_abc123",
  "likerName": "Maria",
  "likerAvatar": "https://assets.akashaverso.com.br/avatars/maria.webp"
}
```

---

## 17. Subscription

Assinatura do plano PLUS do usuário.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `userId` | `UUID` | **FK** → User.id, **UQ** | Usuário assinante |
| `plan` | `String` | NOT NULL, default `PLUS` | Nome do plano |
| `status` | `SubscriptionStatus` | NOT NULL | Status da assinatura |
| `startDate` | `DateTime` | NOT NULL | Início da assinatura |
| `endDate` | `DateTime?` | nullable | Fim da assinatura |
| `trialEnd` | `DateTime?` | nullable | Fim do período de trial |
| `externalId` | `String?` | nullable | ID no gateway de recorrência |

**Enum**:
- `SubscriptionStatus`: `ACTIVE`, `CANCELLED`, `EXPIRED`, `TRIAL`

---

## 18. DailyCard

Carta do dia gerada pelo sistema para todos os usuários.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `date` | `DateTime` | **UQ**, **IDX** | Data (apenas uma por dia) |
| `cardId` | `UUID` | **FK** → Card.id | Carta selecionada |
| `interpretation` | `String` | NOT NULL, max 2000 chars | Interpretação do dia |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data de geração |

**Geração**: Job diário via BullMQ às 00:00 UTC-3 (meia-noite de Brasília). Seleciona aleatoriamente uma carta do baralho ativo e gera interpretação via IA.

---

## Resumo de Tipos

| Tipo Prisma | Tipo PostgreSQL | Uso no arkana-agora |
|-------------|-----------------|----------------------|
| `String` | `TEXT` | Nomes, textos, URLs |
| `Int` | `INTEGER` | Contadores, números de carta |
| `Decimal` | `DECIMAL(10,2)` | Preços, avaliações |
| `Boolean` | `BOOLEAN` | Flags (ativo, público) |
| `DateTime` | `TIMESTAMPTZ` | Datas com timezone |
| `Json` | `JSONB` | Dados estruturados flexíveis |
| `UUID` | `UUID` | Identificadores únicos |
| `String[]` | `TEXT[]` | Arrays de strings (skills, languages) |

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*
