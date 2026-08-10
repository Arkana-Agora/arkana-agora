# SPEC-008: Marketplace -- Design Tecnico

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## 1. Componentes de Interface

### 1.1 MarketplacePage
- Layout de tres colunas (desktop): filtros (esquerda), lista de produtos (centro), resumo (direita)
- Em mobile: filtros em drawer, lista full-width
- Barra de busca no topo
- Breadcrumb de categorias
- Resultados ordenaveis com contador ("123 resultados")
- Grid de produtos responsivo (1 col mobile, 2 tablet, 3 desktop, 4 wide)

### 1.2 ProductCard
- Imagem principal com carousel de thumbnails (hover para trocar)
- Badge de promocao ("-20%") se preco promocional definido
- Badge de "Frete Grátis"
- Titulo (truncado em 2 linhas)
- Preco atual (grande) + preco original riscado (se promocao)
- Nota media (estrelas) + contagem de reviews
- Nome do vendedor + badge verificado
- Botao "Adicionar ao carrinho" (se fisico) ou "Comprar agora"

### 1.3 ProductDetailPage
- Galeria de imagens com zoom on hover
- Titulo, nota, contagem de vendas, contagem de reviews
- preco, opcoes de frete (calculo via CEP)
- Descricao completa (markdown renderizado)
- Variante selector (cor, tamanho)
- Secao de reviews com filtro por nota
- Formulario de nova review (pos-compra)
- Produtos relacionados (mesma categoria, aleatorio)

### 1.4 ProductForm
- Formulario em pagina dedicada `/vendedor/produtos/novo`
- Campos organizados em steps (stepper): Info basica > Midias > Precificacao > Variacoes
- Upload de imagens com drag-and-drop e reordenacao (drag to reorder)
- Editor de descricao com preview markdown
- Seletor de categorias com busca
- Auto-save de rascunho a cada 30 segundos

### 1.5 SellerDashboard
- Layout com sidebar de navegacao e conteudo principal
- Cards de resumo: receita do mes, pedidos pendentes, produtos ativos, media de avaliacao
- Grafico de vendas (linha): ultimos 30 dias
- Tabela de pedidos recentes com filtros de status
- Links rapidos para criar produto e ver todos os pedidos

### 1.6 DisputeForm
- Formulario de abertura de disputa
- Selecao de motivo (radio group)
- Campo de descricao (ate 1000 caracteres)
- Upload de fotos de evidencia (ate 5)
- Timeline da disputa (semelhante a historico de pedido)
- Area de mensagens entre comprador e vendedor

---

## 2. API Endpoints

### Produtos

| Metodo | Endpoint | Descricao |
|---|---|---|
| POST | /api/v1/marketplace/products | Criar produto |
| GET | /api/v1/marketplace/products | Listar produtos (busca + filtros) |
| GET | /api/v1/marketplace/products/:id | Detalhe do produto |
| PATCH | /api/v1/marketplace/products/:id | Atualizar produto |
| DELETE | /api/v1/marketplace/products/:id | Desativar produto |
| POST | /api/v1/marketplace/products/:id/images/presign | Presigned URL para imagem |
| POST | /api/v1/marketplace/products/:id/images/confirm | Confirmar upload de imagem |

### Avaliacoes

| Metodo | Endpoint | Descricao |
|---|---|---|
| POST | /api/v1/marketplace/products/:id/reviews | Criar review |
| GET | /api/v1/marketplace/products/:id/reviews | Listar reviews |
| POST | /api/v1/marketplace/products/:id/reviews/:reviewId/reply | Vendedor responde |

### Vendedor

| Metodo | Endpoint | Descricao |
|---|---|---|
| GET | /api/v1/marketplace/seller/dashboard | Dashboard do vendedor |
| GET | /api/v1/marketplace/seller/products | Lista de produtos do vendedor |
| GET | /api/v1/marketplace/seller/orders | Lista de pedidos |
| GET | /api/v1/marketplace/seller/reports/sales | Relatorio de vendas |

### Disputas

| Metodo | Endpoint | Descricao |
|---|---|---|
| POST | /api/v1/marketplace/orders/:id/dispute | Abrir disputa |
| GET | /api/v1/marketplace/disputes/:id | Detalhe da disputa |
| POST | /api/v1/marketplace/disputes/:id/messages | Enviar mensagem |
| PATCH | /api/v1/marketplace/disputes/:id/resolve | Resolver disputa (admin) |

---

## 3. Database Schema

```prisma
model Product {
  id              String    @id @default(cuid())
  sellerId        String
  title           String
  description     String    @db.Text
  categoryId      String
  subcategoryId   String?
  price           Int       // em centavos
  promotionalPrice Int?     // em centavos
  stock           Int       @default(0)
  type            String    @default("physical") // "physical" | "digital" | "service"
  status          String    @default("draft") // "draft"|"active"|"paused"|"soldout"|"closed"
  freeShipping    Boolean   @default(false)
  deliveryDays    Int?      // prazo de entrega em dias uteis
  specs           Json?     // especificacoes adicionais
  variants        Json?     // [{name, options: [{label, stock, price}]}]
  avgRating       Float     @default(0)
  reviewCount     Int       @default(0)
  salesCount      Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  seller          User      @relation("SellerProducts", fields: [sellerId], references: [id])
  category        Category  @relation(fields: [categoryId], references: [id])
  images          ProductImage[]
  reviews         ProductReview[]
  orderItems      OrderItem[]

  @@index([categoryId, status])
  @@index([sellerId, status])
  @@index([price])
  @@map("products")
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  url       String
  order     Int     @default(0)
  isMain    Boolean @default(false)

  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@map("product_images")
}

model Category {
  id          String     @id @default(cuid())
  name        String
  slug        String     @unique
  parentId    String?
  filters     Json?      // filtros especificos da categoria

  parent      Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryTree")
  products    Product[]

  @@unique([parentId, slug])
  @@map("categories")
}

model ProductReview {
  id         String   @id @default(cuid())
  productId  String
  userId     String
  orderId    String   // vincula a compra
  rating     Int      // 1-5
  title      String?
  content    String?  @db.Text
  photos     String[]?
  sellerReply String?  @db.Text
  repliedAt  DateTime?
  createdAt  DateTime @default(now())

  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  user       User     @relation(fields: [userId], references: [id])
  order      Order    @relation(fields: [orderId], references: [id])

  @@unique([orderId, userId]) // 1 review por compra
  @@map("product_reviews")
}

model Dispute {
  id         String   @id @default(cuid())
  orderId    String   @unique
  buyerId    String
  sellerId   String
  reason     String   // "not_delivered" | "different" | "defective" | "other"
  description String  @db.Text
  evidence   String[]?
  status     String   @default("open") // "open"|"negotiating"|"analyzing"|"resolved"
  resolution String?  // "full_refund" | "partial_refund" | "no_refund"
  refundAmount Int?   // em centavos
  createdAt  DateTime @default(now())
  resolvedAt DateTime?

  messages   DisputeMessage[]

  @@map("disputes")
}

model DisputeMessage {
  id        String   @id @default(cuid())
  disputeId String
  authorId  String
  role      String   // "buyer" | "seller" | "admin"
  content   String   @db.Text
  createdAt DateTime @default(now())

  dispute   Dispute  @relation(fields: [disputeId], references: [id], onDelete: Cascade)

  @@map("dispute_messages")
}

model Order {
  id          String   @id @default(cuid())
  buyerId     String
  totalAmount Int      // em centavos
  status      String   @default("pending") // "pending"|"paid"|"shipped"|"delivered"|"cancelled"
  shippingCep String?
  shippingAddress Json?
  trackingCode String?
  paidAt      DateTime?
  shippedAt   DateTime?
  deliveredAt DateTime?
  createdAt   DateTime @default(now())

  buyer       User     @relation("BuyerOrders", fields: [buyerId], references: [id])
  items       OrderItem[]
  dispute     Dispute?

  @@index([buyerId, createdAt])
  @@map("orders")
}

model OrderItem {
  id         String  @id @default(cuid())
  orderId    String
  productId  String
  quantity   Int
  unitPrice  Int     // em centavos no momento da compra

  order      Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product    Product @relation(fields: [productId], references: [id])

  @@map("order_items")
}
```

---

## 4. Busca Full-Text

Utilizar a funcionalidade nativa do PostgreSQL para busca textual:

```typescript
// Utilizando Prisma com $queryRaw para busca full-text
async function searchProducts(query: string, filters: SearchFilters) {
  return prisma.$queryRaw`
    SELECT p.*,
      ts_rank_cd(
        setweight(to_tsvector('portuguese', p.title), 'A') ||
        setweight(to_tsvector('portuguese', p.description), 'B'),
        plainto_tsquery('portuguese', ${query})
      ) AS rank
    FROM products p
    WHERE p.status = 'active'
      AND (
        to_tsvector('portuguese', p.title) @@ plainto_tsquery('portuguese', ${query})
        OR to_tsvector('portuguese', p.description) @@ plainto_tsquery('portuguese', ${query})
      )
      ${filters.categoryId ? Prisma.sql`AND p."categoryId" = ${filters.categoryId}` : Prisma.sql``}
      ${filters.minPrice ? Prisma.sql`AND p.price >= ${filters.minPrice * 100}` : Prisma.sql``}
      ${filters.maxPrice ? Prisma.sql`AND p.price <= ${filters.maxPrice * 100}` : Prisma.sql``}
      ${filters.minRating ? Prisma.sql`AND p."avgRating" >= ${filters.minRating}` : Prisma.sql``}
    ORDER BY rank DESC
    LIMIT 24
    OFFSET ${filters.offset || 0}
  `;
}
```

---

## 5. Rotas da Aplicacao

| Rota | Componente | Protegida | Descricao |
|---|---|---|---|
| `/marketplace` | MarketplacePage | Nao | Listagem e busca de produtos |
| `/marketplace/:categorySlug` | MarketplacePage | Nao | Listagem filtrada por categoria |
| `/produto/:id` | ProductDetailPage | Nao | Detalhe do produto |
| `/vendedor/produtos` | SellerProductsPage | Sim (Plus) | Lista de produtos do vendedor |
| `/vendedor/produtos/novo` | ProductForm | Sim (Plus) | Criar novo produto |
| `/vendedor/produtos/:id/editar` | ProductForm | Sim (Plus) | Editar produto |
| `/vendedor/painel` | SellerDashboard | Sim (Plus) | Dashboard do vendedor |
| `/vendedor/pedidos` | SellerOrdersPage | Sim (Plus) | Pedidos recebidos |
| `/pedidos/:id` | OrderDetailPage | Sim | Detalhe de um pedido |
| `/pedidos/:id/disputa` | DisputePage | Sim | Fluxo de disputa |