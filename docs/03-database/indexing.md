# Estratégia de Indexação — arkana-agora

> Versão: 1.0 | Última atualização: 2026-08-12

---

> **Status:** **5 models implementados** — `User`, `UserProfile`, `Subscription`, `Session`, `VerificationToken` (init migration `20260813000605_init` aplicada em dev PostgreSQL). As outras **13 entidades estão planejadas** e não existem ainda no schema. `Session`/`VerificationToken` **não têm seção aqui** — são cópia de `.specs/001-auth/design.md` §4 (rotas custom `/api/v1/auth/*`, ADR-009). Consulte `prisma/schema.prisma` para o que está realmente implementado.

---

## 1. Visão Geral

A estratégia de indexação do arkana-agora visa otimizar as consultas mais frequentes e críticas para a experiência do usuário, equilibrando performance de leitura com custo de escrita e armazenamento.

```
Consultas mais frequentes (ordenadas por impacto):

1. Buscar leituras do usuário (ordenadas por data)
2. Feed social (postagens públicas, ordenadas por data)
3. Notificações não lidas
4. Produtos ativos de um vendedor
5. Carta do dia (hoje)
6. Login/autenticação (por email ou provider)
7. Busca de produtos por texto
8. Seguidores/seguindo de um usuário
9. Comentários de uma postagem
10. Histórico de pagamentos
```

---

## 2. Índices Primários (PK)

Todas as 18 entidades possuem índice primário automático via `@id`.

| Entidade | Coluna PK | Tipo | Nota |
|----------|-----------|------|------|
| User | `id` | UUID | Clustered index (padrão PostgreSQL) |
| UserProfile | `id` | UUID | — |
| Reading | `id` | UUID | — |
| Card | `id` | UUID | — |
| TarotDeck | `id` | UUID | — |
| ArcanaCalculation | `id` | UUID | — |
| HoroscopeEntry | `id` | UUID | — |
| Spread | `id` | UUID | — |
| Follow | `id` | UUID | — |
| Post | `id` | UUID | — |
| Comment | `id` | UUID | — |
| Product | `id` | UUID | — |
| Order | `id` | UUID | — |
| Payment | `id` | UUID | — |
| Gift | `id` | UUID | — |
| Notification | `id` | UUID | — |
| Subscription | `id` | UUID | — |
| DailyCard | `id` | UUID | — |

---

## 3. Índices Únicos (UQ)

Garantem integridade de dados e otimizam buscas por campos exclusivos.

| Tabela | Coluna(s) | Consulta Otimizada | Tipo |
|--------|-----------|-------------------|------|
| `User` | `email` | Login por e-mail, verificação de unicidade | B-tree único |
| `User` | `(provider, providerId)` | Login OAuth, evitar duplicidade de conta | B-tree composto único |
| `UserProfile` | `userId` | Busca de perfil por usuário (1:1) | B-tree único |
| `Subscription` | `userId` | Busca de assinatura ativa | B-tree único |
| `Follow` | `(followerId, followingId)` | Impedir follow duplicado | B-tree composto único |
| `DailyCard` | `date` | Garantir uma carta por dia | B-tree único |
| `Payment` | `externalId` | Webhook do Mercado Pago (idempotência) | B-tree único |
| `TarotDeck` | `name` | Impedir baralhos duplicados | B-tree único |

### Detalhes por Índice Único

#### `User.email`
```prisma
model User {
  email String @unique  // Cria automaticamente: CREATE UNIQUE INDEX "User_email_key" ON "User"("email")
}
```

**Consultas otimizadas**:
```sql
-- Login
SELECT * FROM "User" WHERE email = 'usuario@email.com';

-- Registro — verificação de unicidade
SELECT 1 FROM "User" WHERE email = 'novo@email.com';
```

#### `User(provider, providerId)`
```prisma
model User {
  provider   AuthProvider
  providerId String
  @@unique([provider, providerId])
}
```

**Consultas otimizadas**:
```sql
-- Callback OAuth — encontrar ou criar usuário
SELECT * FROM "User" WHERE provider = 'GOOGLE' AND "providerId" = 'google_123456789';
```

#### `Follow(followerId, followingId)`
```prisma
model Follow {
  followerId  UUID
  followingId UUID
  @@unique([followerId, followingId])
}
```

**Consultas otimizadas**:
```sql
-- Verificar se já segue
SELECT 1 FROM "Follow" WHERE "followerId" = 'user_a' AND "followingId" = 'user_b';
```

---

## 4. Índices Compostos

Índices em múltiplas colunas para consultas com filtros combinados.

### 4.1 Reading(userId, createdAt)

```prisma
model Reading {
  userId    UUID     @indexed
  createdAt DateTime @default(now())
  @@index([userId, createdAt(sort: Desc)])
}
```

**Consulta otimizada**:
```sql
-- Leituras mais recentes do usuário (paginação)
SELECT * FROM "Reading"
WHERE "userId" = 'user_abc'
ORDER BY "createdAt" DESC
LIMIT 20 OFFSET 0;
```

**Racional**: A maioria das consultas de leitura filtra por `userId` e ordena por `createdAt DESC`. Índice composto cobre ambas as operações.

### 4.2 Post(authorId, isPublic, createdAt)

```prisma
model Post {
  authorId  UUID     @indexed
  isPublic  Boolean  @default(true)
  createdAt DateTime @default(now())
  @@index([authorId, isPublic, createdAt(sort: Desc)])
}
```

**Consultas otimizadas**:
```sql
-- Postagens públicas de um autor
SELECT * FROM "Post"
WHERE "authorId" = 'user_abc' AND "isPublic" = true
ORDER BY "createdAt" DESC;

-- Postagens de um autor (incluindo privadas)
SELECT * FROM "Post"
WHERE "authorId" = 'user_abc'
ORDER BY "createdAt" DESC;
```

### 4.3 Post(isPublic, createdAt)

```prisma
model Post {
  isPublic  Boolean
  createdAt DateTime @default(now())
  @@index([isPublic, createdAt(sort: Desc)])
}
```

**Consulta otimizada**:
```sql
-- Feed global — postagens públicas recentes
SELECT p.*, u."displayName", u.avatar
FROM "Post" p
JOIN "User" u ON p."authorId" = u.id
WHERE p."isPublic" = true
ORDER BY p."createdAt" DESC
LIMIT 20;
```

### 4.4 Product(sellerId, isActive)

```prisma
model Product {
  sellerId UUID    @indexed
  isActive Boolean @default(true)
  @@index([sellerId, isActive])
}
```

**Consultas otimizadas**:
```sql
-- Produtos ativos de um vendedor
SELECT * FROM "Product"
WHERE "sellerId" = 'user_prof' AND "isActive" = true;
```

### 4.5 Follow(followerId)

```prisma
model Follow {
  followerId  UUID @indexed
  followingId UUID @indexed
  // @@unique já cobre followerId + followingId
  // Estes índices extras otimizam consultas unidirecionais
}
```

**Consultas otimizadas**:
```sql
-- Lista de quem eu sigo (following)
SELECT "followingId" FROM "Follow" WHERE "followerId" = 'user_me';

-- Lista de quem me segue (followers)
SELECT "followerId" FROM "Follow" WHERE "followingId" = 'user_me';
```

### 4.6 Notification(userId, isRead, createdAt)

```prisma
model Notification {
  userId    UUID    @indexed
  isRead    Boolean @default(false)
  createdAt DateTime @default(now())
  @@index([userId, isRead, createdAt(sort: Desc)])
}
```

**Consultas otimizadas**:
```sql
-- Notificações não lidas (ordenadas)
SELECT * FROM "Notification"
WHERE "userId" = 'user_abc' AND "isRead" = false
ORDER BY "createdAt" DESC
LIMIT 20;

-- Contar não lidas
SELECT COUNT(*) FROM "Notification"
WHERE "userId" = 'user_abc' AND "isRead" = false;
```

### 4.7 DailyCard(date)

```prisma
model DailyCard {
  date DateTime @unique  // Índice único cobre busca por data
}
```

**Consulta otimizada**:
```sql
-- Carta do dia de hoje
SELECT dc.*, c.name, c."imageUrl", c."meaning_upright"
FROM "DailyCard" dc
JOIN "Card" c ON dc."cardId" = c.id
WHERE dc.date = CURRENT_DATE;
```

### 4.8 Order(buyerId, createdAt)

```prisma
model Order {
  buyerId   UUID    @indexed
  createdAt DateTime @default(now())
  @@index([buyerId, createdAt(sort: Desc)])
}
```

### 4.9 Payment(userId, createdAt)

```prisma
model Payment {
  userId    UUID    @indexed
  createdAt DateTime @default(now())
  @@index([userId, createdAt(sort: Desc)])
}
```

### 4.10 Comment(postId, createdAt)

```prisma
model Comment {
  postId    UUID    @indexed
  createdAt DateTime @default(now())
  @@index([postId, createdAt(sort: Asc)])
}
```

**Nota**: Comentários ordenados de forma ascendente (mais antigos primeiro).

---

## 5. Índices Full-Text (FTS)

Busca textual para marketplace e conteúdo social.

### 5.1 Product — Busca por nome e descrição

```prisma
model Product {
  name        String
  description String
  @@index([name(ops: raw), description(ops: raw)], map: "Product_name_description_idx", type: GIN)
}
```

**Prisma não suporta GIN nativamente** — criar via SQL raw migration:

```sql
-- Migration SQL para FTS
CREATE INDEX "Product_name_fts_idx" ON "Product" USING GIN (to_tsvector('portuguese', "name"));
CREATE INDEX "Product_description_fts_idx" ON "Product" USING GIN (to_tsvector('portuguese', "description"));

-- Índice composto FTS (nome + descrição)
CREATE INDEX "Product_full_fts_idx" ON "Product" USING GIN (
  to_tsvector('portuguese', coalesce("name", '') || ' ' || coalesce("description", ''))
);
```

**Consulta otimizada**:
```sql
-- Busca de produtos
SELECT p.*, u."displayName" as "sellerName"
FROM "Product" p
JOIN "User" u ON p."sellerId" = u.id
WHERE to_tsvector('portuguese', p.name || ' ' || p.description) @@ to_tsquery('portuguese', 'tarot & amor')
  AND p."isActive" = true
ORDER BY ts_rank(
  to_tsvector('portuguese', p.name || ' ' || p.description),
  to_tsquery('portuguese', 'tarot & amor')
) DESC
LIMIT 20;
```

### 5.2 Post — Busca por conteúdo

```sql
-- Migration SQL para FTS de postagens
CREATE INDEX "Post_content_fts_idx" ON "Post" USING GIN (to_tsvector('portuguese', "content"));
```

**Consulta otimizada**:
```sql
SELECT p.*, u."displayName", u.avatar
FROM "Post" p
JOIN "User" u ON p."authorId" = u.id
WHERE to_tsvector('portuguese', p.content) @@ plainto_tsquery('portuguese', 'leitura de tarot amor')
  AND p."isPublic" = true
ORDER BY p."createdAt" DESC
LIMIT 20;
```

---

## 6. Índices Parciais

Índices que cobrem apenas um subconjunto de linhas, reduzindo tamanho e custo de manutenção.

### 6.1 Notification — Não lidas

```sql
-- O índice composto @@index([userId, isRead, createdAt]) já cobre
-- Mas um índice parcial pode ser mais eficiente para a consulta de count
CREATE INDEX "Notification_unread_idx" ON "Notification" ("userId")
WHERE "isRead" = false;
```

**Racional**: A maioria das notificações se torna `isRead = true` rapidamente. O índice parcial só armazena as não lidas, sendo significativamente menor.

**Consulta otimizada**:
```sql
SELECT COUNT(*) FROM "Notification" WHERE "userId" = 'user_abc' AND "isRead" = false;
```

### 6.2 Product — Ativos

```sql
CREATE INDEX "Product_active_idx" ON "Product" ("sellerId")
WHERE "isActive" = true;
```

### 6.3 Post — Públicos

```sql
CREATE INDEX "Post_public_idx" ON "Post" ("createdAt" DESC)
WHERE "isPublic" = true;
```

---

## 7. Matriz Completa de Índices

| # | Tabela | Coluna(s) | Tipo | Único | Uso Principal |
|---|--------|-----------|------|:-----:|---------------|
| 1 | User | `id` | B-tree PK | ✅ | Lookup por ID |
| 2 | User | `email` | B-tree UQ | ✅ | Login, verificação |
| 3 | User | `(provider, providerId)` | B-tree UQ | ✅ | Login OAuth |
| 4 | UserProfile | `userId` | B-tree UQ | ✅ | Perfil do usuário |
| 5 | Subscription | `userId` | B-tree UQ | ✅ | Assinatura ativa |
| 6 | Reading | `(userId, createdAt DESC)` | B-tree | ❌ | Leituras do usuário |
| 7 | Card | `deckId` | B-tree | ❌ | Cartas por baralho |
| 8 | DailyCard | `date` | B-tree UQ | ✅ | Carta do dia |
| 9 | DailyCard | `cardId` | B-tree | ❌ | Carta do dia por carta |
| 10 | Follow | `(followerId, followingId)` | B-tree UQ | ✅ | Impedir duplicidade |
| 11 | Follow | `followerId` | B-tree | ❌ | Lista de following |
| 12 | Follow | `followingId` | B-tree | ❌ | Lista de followers |
| 13 | Post | `(authorId, isPublic, createdAt DESC)` | B-tree | ❌ | Posts do autor |
| 14 | Post | `(isPublic, createdAt DESC)` | B-tree | ❌ | Feed global |
| 15 | Post | `content` | GIN (FTS) | ❌ | Busca de posts |
| 16 | Comment | `(postId, createdAt ASC)` | B-tree | ❌ | Comentários de post |
| 17 | Product | `(sellerId, isActive)` | B-tree | ❌ | Produtos do vendedor |
| 18 | Product | `name` | GIN (FTS) | ❌ | Busca de produtos |
| 19 | Product | `description` | GIN (FTS) | ❌ | Busca de produtos |
| 20 | Order | `(buyerId, createdAt DESC)` | B-tree | ❌ | Pedidos do comprador |
| 21 | Order | `productId` | B-tree | ❌ | Pedidos de produto |
| 22 | Payment | `userId` | B-tree | ❌ | Pagamentos do usuário |
| 23 | Payment | `orderId` | B-tree | ❌ | Pagamento do pedido |
| 24 | Payment | `externalId` | B-tree UQ | ✅ | Idempotência webhook |
| 25 | Notification | `(userId, isRead, createdAt DESC)` | B-tree | ❌ | Notificações |
| 26 | Notification | `userId` WHERE `isRead = false` | B-tree Parcial | ❌ | Contar não lidas |
| 27 | Gift | `senderId` | B-tree | ❌ | Presentes enviados |
| 28 | Gift | `receiverId` | B-tree | ❌ | Presentes recebidos |
| 29 | ArcanaCalculation | `userId` | B-tree | ❌ | Arcanos do usuário |
| 30 | HoroscopeEntry | `userId` | B-tree | ❌ | Horóscopos do usuário |

---

## 8. Monitoramento de Índices

### 8.1 Consultas Lentas

O Neon PostgreSQL disponibiliza `pg_stat_statements` para identificar queries lentas:

```sql
-- Top 10 queries mais lentas
SELECT query,
       calls,
       total_exec_time,
       mean_exec_time,
       max_exec_time,
       rows
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 8.2 Uso de Índices

Verificar se índices estão sendo utilizados:

```sql
-- Índices não utilizados (candidatos a remoção)
SELECT schemaname,
       tablename,
       indexname,
       idx_scan as index_scans
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Tamanho dos índices
SELECT indexname,
       pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
       idx_scan
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
```

### 8.3 Seq Scans Indesejados

```sql
-- Tabelas com mais sequential scans que index scans
SELECT relname,
       seq_scan,
       idx_scan,
       n_live_tup as row_count,
       CASE WHEN seq_scan > idx_scan THEN '⚠️ Possível problema' ELSE '✅ OK' END as status
FROM pg_stat_user_tables
WHERE n_live_tup > 1000
ORDER BY seq_scan DESC;
```

### 8.4 Análise EXPLAIN

Para qualquer consulta suspeita, executar:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM "Reading"
WHERE "userId" = 'user_abc'
ORDER BY "createdAt" DESC
LIMIT 20;
```

**Indicadores de problema**:
- `Seq Scan` em tabelas grandes (>10K linhas)
- `actual time` alto (>100ms por query)
- `loops` alto (N+1 problem)
- `Sort` com custo alto (falta índice na coluna ORDER BY)

---

## 9. Manutenção de Índices

### 9.1 REINDEX

O PostgreSQL pode precisar de reindexação após muitas atualizações/deleções:

```sql
-- Reindexar índice específico (CONCURRENTLY não bloqueia a tabela)
REINDEX INDEX CONCURRENTLY "Reading_userId_createdAt_idx";

-- Reindexar todos os índices de uma tabela
REINDEX TABLE CONCURRENTLY "Post";
```

### 9.2 VACUUM e ANALYZE

O Neon gerencia VACUUM automaticamente, mas pode ser necessário em casos específicos:

```sql
-- Analisar estatísticas (atualiza planejador de queries)
ANALYZE "Reading";

-- VACUUM agressivo para tabelas com muitas atualizações
VACUUM ANALYZE "Notification";
```

### 9.3 Cron de Manutenção

Recomendado para produção (via BullMQ worker ou cron externo):

| Tarefa | Frequência | Comando |
|--------|------------|---------|
| ANALYZE | Diário | `ANALYZE;` (todas as tabelas) |
| Verificar índices inutilizados | Semanal | Query de `idx_scan = 0` |
| Verificar bloat de tabela | Semanal | `pgstattuple` extension |
| Reindexação parcial | Mensal | `REINDEX INDEX CONCURRENTLY` nos mais fragmentados |

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*
