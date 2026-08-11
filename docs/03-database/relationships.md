# Relacionamentos — arkana-agora

> Versão: 1.0 | Última atualização: 2025-07-11

---

> **Status:** **§1 User implementado** — outros 17 entidades estão **planejados** e não existem ainda no schema. Consulte `prisma/schema.prisma` para o que está realmente implementado.

---

## 1. Visão Geral dos Relacionamentos

O banco de dados possui **16 relacionamentos** entre 18 entidades, distribuídos entre relações **1:1**, **1:N** e **N:M** (via tabela juntura).

| # | Entidade A | Entidade B | Tipo | Descrição |
|---|------------|------------|------|-----------|
| 1 | User | UserProfile | 1:1 | Cada usuário tem um perfil extendido |
| 2 | User | Subscription | 1:1 | Cada usuário tem no máximo uma assinatura ativa |
| 3 | User | Reading | 1:N | Cada usuário tem múltiplas leituras |
| 4 | User | ArcanaCalculation | 1:N | Cada usuário pode ter múltiplos cálculos |
| 5 | User | HoroscopeEntry | 1:N | Cada usuário tem múltiplos horóscopos |
| 6 | User | Post | 1:N | Cada usuário faz múltiplas postagens |
| 7 | User | Comment | 1:N | Cada usuário faz múltiplos comentários |
| 8 | User | Follow (follower) | 1:N | Cada usuário segue múltiplos outros |
| 9 | User | Follow (following) | 1:N | Cada usuário é seguido por múltiplos |
| 10 | User | Product | 1:N | Cada profissional vende múltiplos produtos |
| 11 | User | Order | 1:N | Cada usuário faz múltiplos pedidos |
| 12 | User | Payment | 1:N | Cada usuário tem múltiplos pagamentos |
| 13 | User | Notification | 1:N | Cada usuário recebe múltiplas notificações |
| 14 | User | Gift (sender) | 1:N | Cada usuário envia múltiplos presentes |
| 15 | User | Gift (receiver) | 1:N | Cada usuário recebe múltiplos presentes |
| 16 | TarotDeck | Card | 1:N | Cada baralho contém múltiplas cartas |
| 17 | Post | Comment | 1:N | Cada postagem tem múltiplos comentários |
| 18 | Post | Reading | 1:N? | Postagem pode referenciar uma leitura |
| 19 | Product | Order | 1:N | Cada produto pode ter múltiplos pedidos |
| 20 | Order | Payment | 1:1? | Cada pedido tem no máximo um pagamento |
| 21 | Card | DailyCard | 1:N | Uma carta pode ser "carta do dia" múltiplas vezes |

---

## 2. Relacionamentos 1:1

### 2.1 User ↔ UserProfile

```
User (1) ────────── (1) UserProfile
```

- **HasForeignKey**: `UserProfile.userId` → `User.id`
- **OnDelete**: `CASCADE` (se o usuário é deletado, o perfil vai junto)
- **OnUpdate**: `CASCADE`
- **Unique**: `UserProfile.userId` é único (garante 1:1)

**Prisma**:
```prisma
model User {
  profile UserProfile?
}

model UserProfile {
  id     UUID @id @default(uuid())
  userId UUID @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### 2.2 User ↔ Subscription

```
User (1) ────────── (0..1) Subscription
```

- **HasForeignKey**: `Subscription.userId` → `User.id`
- **OnDelete**: `SET NULL` (manter histórico se usuário for deletado) — ou `CASCADE` se não houver exigência de retenção
- **OnUpdate**: `CASCADE`
- **Unique**: `Subscription.userId` é único
- **Nota**: Usuários FREE não possuem registro em Subscription

**Prisma**:
```prisma
model User {
  subscription Subscription?
}

model Subscription {
  id     UUID @id @default(uuid())
  userId UUID @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 3. Relacionamentos 1:N

### 3.1 User → Reading

```
User (1) ──────── (N) Reading
```

- **HasForeignKey**: `Reading.userId` → `User.id`
- **OnDelete**: `CASCADE` (leituras são excluídas com o usuário)
- **OnUpdate**: `CASCADE`

### 3.2 User → ArcanaCalculation

```
User (1) ──────── (N) ArcanaCalculation
```

- **HasForeignKey**: `ArcanaCalculation.userId` → `User.id`
- **OnDelete**: `CASCADE`
- **OnUpdate**: `CASCADE`

### 3.3 User → HoroscopeEntry

```
User (1) ──────── (N) HoroscopeEntry
```

- **HasForeignKey**: `HoroscopeEntry.userId` → `User.id`
- **OnDelete**: `CASCADE`
- **OnUpdate**: `CASCADE`

### 3.4 User → Post

```
User (1) ──────── (N) Post
```

- **HasForeignKey**: `Post.authorId` → `User.id`
- **OnDelete**: `CASCADE` (postagens são removidas com o usuário)
- **OnUpdate**: `CASCADE`

### 3.5 Post → Comment

```
Post (1) ──────── (N) Comment
```

- **HasForeignKey**: `Comment.postId` → `Post.id`
- **OnDelete**: `CASCADE` (comentários são removidos com a postagem)
- **OnUpdate**: `CASCADE`

### 3.6 User → Comment

```
User (1) ──────── (N) Comment
```

- **HasForeignKey**: `Comment.authorId` → `User.id`
- **OnDelete**: `SET NULL` (manter comentário, mas remover referência ao autor)
- **OnUpdate**: `CASCADE`

### 3.7 User → Product (Vendedor)

```
User (1) ──────── (N) Product
```

- **HasForeignKey**: `Product.sellerId` → `User.id`
- **OnDelete**: `SET NULL` (produtos permanecem, mas perdem referência ao vendedor)
- **OnUpdate**: `CASCADE`

### 3.8 Product → Order

```
Product (1) ──────── (N) Order
```

- **HasForeignKey**: `Order.productId` → `Product.id`
- **OnDelete**: `RESTRICT` (não permitir excluir produto com pedidos pendentes)
- **OnUpdate**: `CASCADE`

### 3.9 User → Order (Comprador)

```
User (1) ──────── (N) Order
```

- **HasForeignKey**: `Order.buyerId` → `User.id`
- **OnDelete**: `SET NULL`
- **OnUpdate**: `CASCADE`

### 3.10 Order → Payment (1:1 opcional)

```
Order (1) ──────── (0..1) Payment
```

- **HasForeignKey**: `Payment.orderId` → `Order.id`
- **OnDelete**: `SET NULL`
- **OnUpdate**: `CASCADE`

### 3.11 User → Payment

```
User (1) ──────── (N) Payment
```

- **HasForeignKey**: `Payment.userId` → `User.id`
- **OnDelete**: `CASCADE`
- **OnUpdate**: `CASCADE`

### 3.12 User → Notification

```
User (1) ──────── (N) Notification
```

- **HasForeignKey**: `Notification.userId` → `User.id`
- **OnDelete**: `CASCADE`
- **OnUpdate**: `CASCADE`

### 3.13 TarotDeck → Card

```
TarotDeck (1) ──────── (N) Card
```

- **HasForeignKey**: `Card.deckId` → `TarotDeck.id`
- **OnDelete**: `CASCADE` (cartas pertencem ao baralho)
- **OnUpdate**: `CASCADE`

### 3.14 Card → DailyCard

```
Card (1) ──────── (N) DailyCard
```

- **HasForeignKey**: `DailyCard.cardId` → `Card.id`
- **OnDelete**: `RESTRICT` (não permitir excluir carta usada em DailyCard)
- **OnUpdate**: `CASCADE`

### 3.15 User → Gift (Envio)

```
User (sender, 1) ──────── (N) Gift
```

- **HasForeignKey**: `Gift.senderId` → `User.id`
- **OnDelete**: `CASCADE`
- **OnUpdate**: `CASCADE`

### 3.16 User → Gift (Recebimento)

```
User (receiver, 1) ──────── (N) Gift
```

- **HasForeignKey**: `Gift.receiverId` → `User.id`
- **OnDelete**: `CASCADE`
- **OnUpdate**: `CASCADE`

---

## 4. Relacionamento N:M

### 4.1 User ↔ User (Follow)

```
User (N) ──────── Follow ──────── (N) User
(followers)   (tabela juntura)   (following)
```

- **Tabela juntura**: `Follow`
- **HasForeignKey 1**: `Follow.followerId` → `User.id`
- **HasForeignKey 2**: `Follow.followingId` → `User.id`
- **OnDelete**: `CASCADE` (em ambos)
- **OnUpdate**: `CASCADE`
- **Unique composto**: `@@unique([followerId, followingId])`

**Prisma**:
```prisma
model User {
  id        UUID    @id @default(uuid())
  following Follow[] @relation("UserFollowing", references: [followerId])
  followers Follow[] @relation("UserFollowers", references: [followingId])
}

model Follow {
  id          UUID   @id @default(uuid())
  followerId  UUID
  followingId UUID
  follower    User   @relation("UserFollowing", fields: [followerId], references: [id], onDelete: Cascade)
  following   User   @relation("UserFollowers", fields: [followingId], references: [id], onDelete: Cascade)

  @@unique([followerId, followingId])
}
```

---

## 5. Matriz de Cascade

| De → Para | CASCADE | SET NULL | RESTRICT | Sem Ação |
|-----------|:-------:|:--------:|:--------:|:--------:|
| User → UserProfile | ✅ | | | |
| User → Subscription | ✅ | | | |
| User → Reading | ✅ | | | |
| User → ArcanaCalculation | ✅ | | | |
| User → HoroscopeEntry | ✅ | | | |
| User → Post | ✅ | | | |
| User → Comment | | ✅ | | |
| User → Product | | ✅ | | |
| User → Order | | ✅ | | |
| User → Payment | ✅ | | | |
| User → Notification | ✅ | | | |
| User → Gift (sender) | ✅ | | | |
| User → Gift (receiver) | ✅ | | | |
| Post → Comment | ✅ | | | |
| Product → Order | | | ✅ | |
| Order → Payment | | ✅ | | |
| Card → DailyCard | | | ✅ | |

**Racional das decisões**:

- **CASCADE**: Dados que pertencem exclusivamente ao usuário ou não fazem sentido sem ele (leituras, notificações, perfil)
- **SET NULL**: Dados que podem ter valor histórico ou de auditoria (comentários de autores deletados, pedidos, pagamentos)
- **RESTRICT**: Prevenção de perda de dados importantes (excluir produto com pedidos ativos, excluir carta já usada em DailyCard)

---

## 6. Estratégia de Índices por Relacionamento

### 6.1 Índices de Foreign Key

Todas as colunas de foreign key possuem índice automático no PostgreSQL (criado pelo Prisma). Entretanto, para consultas compostas frequentes, índices adicionais são necessários:

| Relacionamento | Índice Composto | Consulta Otimizada |
|----------------|-----------------|-------------------|
| User → Reading | `@@index([userId, createdAt])` | "Leituras mais recentes do usuário" |
| User → Post | `@@index([authorId, isPublic, createdAt])` | "Postagens públicas por autor, ordenadas" |
| User → Product | `@@index([sellerId, isActive])` | "Produtos ativos de um vendedor" |
| Post → Comment | `@@index([postId, createdAt])` | "Comentários de um post, mais recentes" |
| User → Notification | `@@index([userId, isRead])` parcial | "Notificações não lidas" |
| User → Follow | `@@index([followerId])` + `@@index([followingId])` | "Quem eu sigo" / "Quem me segue" |
| DailyCard → date | `@@unique([date])` | "Carta do dia de hoje" |

### 6.2 Índices para Joins Frequentes

| Consulta | Tabelas Envolvidas | Índice Recomendado |
|----------|-------------------|---------------------|
| Feed com dados do autor | Post + User + UserProfile | `Post(authorId)` + `UserProfile(userId)` (já existe via FK) |
| Leitura com cartas | Reading + Card (via JSON) | N/A (cartas armazenadas como JSON na Reading) |
| Perfil do profissional | User + UserProfile + Product | `Product(sellerId, isActive)` |

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*
