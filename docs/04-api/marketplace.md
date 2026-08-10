# API de Marketplace — arkana-agora

> **Módulo**: `src/app/api/v1/marketplace/` | **Pagamentos**: Mercado Pago SDK | **Autenticação**: Obrigatória

## Sumário

- [GET /marketplace/products](#get-marketplaceproducts)
- [GET /marketplace/products/:id](#get-marketplaceproductsid)
- [POST /marketplace/products](#post-marketplaceproducts)
- [PATCH /marketplace/products/:id](#patch-marketplaceproductsid)
- [DELETE /marketplace/products/:id](#delete-marketplaceproductsid)
- [POST /marketplace/orders](#post-marketplaceorders)
- [GET /marketplace/orders](#get-marketplaceorders)
- [GET /marketplace/orders/:id](#get-marketplaceordersid)
- [POST /marketplace/reviews](#post-marketplacereviews)
- [GET /marketplace/sellers/:id](#get-marketplacesellersid)

---

## GET /marketplace/products

Lista produtos disponíveis no marketplace.

### Requisição

```http
GET /api/v1/marketplace/products?category=baralho&minPrice=30&maxPrice=200&sortBy=popular&page=1&limit=20
```

### Parâmetros de Query

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `category` | string | Todos | `baralho`, `acessorio`, `curso`, `ebook`, `servico` |
| `minPrice` | number | — | Preço mínimo (BRL) |
| `maxPrice` | number | — | Preço máximo (BRL) |
| `sortBy` | string | `recent` | `recent`, `popular`, `price_asc`, `price_desc`, `rating` |
| `search` | string | — | Busca por nome/descrição |
| `sellerId` | string | — | Filtrar por vendedor |
| `page` | number | 1 | Página atual |
| `limit` | number | 20 | Itens por página (máx 50) |

### Resposta — 200 OK

```json
{
  "data": [
    {
      "id": "prod_a1b2",
      "name": "Baralho Tarot Rider-Waite Edição Especial",
      "description": "Edição especial com folha de ouro e guia ilustrado em português.",
      "category": "baralho",
      "price": 129.90,
      "installments": { "count": 3, "value": 43.30 },
      "images": [
        "/products/prod_a1b2/img1.jpg",
        "/products/prod_a1b2/img2.jpg"
      ],
      "seller": {
        "id": "usr_seller1",
        "name": "Mística Store",
        "avatar": "/avatars/usr_seller1.jpg",
        "rating": 4.8
      },
      "rating": {
        "average": 4.7,
        "count": 34
      },
      "stock": 25,
      "isDigital": false,
      "createdAt": "2025-01-10T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 145,
    "totalPages": 8
  }
}
```

---

## GET /marketplace/products/:id

Retorna detalhe completo de um produto.

### Requisição

```http
GET /api/v1/marketplace/products/prod_a1b2
```

### Resposta — 200 OK

```json
{
  "data": {
    "id": "prod_a1b2",
    "name": "Baralho Tarot Rider-Waite Edição Especial",
    "description": "Edição especial com folha de ouro e guia ilustrado em português. 78 cartas com acabamento premium e bordas douradas.",
    "category": "baralho",
    "price": 129.90,
    "compareAtPrice": 159.90,
    "installments": { "count": 3, "value": 43.30 },
    "images": [
      { "url": "/products/prod_a1b2/img1.jpg", "alt": "Frente do baralho" },
      { "url": "/products/prod_a1b2/img2.jpg", "alt": "Verso do baralho" },
      { "url": "/products/prod_a1b2/img3.jpg", "alt": "Detalhe da caixa" }
    ],
    "specifications": [
      { "label": "Material", "value": "Papel couchê 350g" },
      { "label": "Dimensões", "value": "7 x 12 cm" },
      { "label": "Peso", "value": "320g" }
    ],
    "seller": {
      "id": "usr_seller1",
      "name": "Mística Store",
      "avatar": "/avatars/usr_seller1.jpg",
      "rating": 4.8,
      "totalSales": 1200,
      "memberSince": "2024-03-01T00:00:00Z"
    },
    "rating": {
      "average": 4.7,
      "count": 34,
      "distribution": { "5": 22, "4": 8, "3": 3, "2": 1, "1": 0 }
    },
    "stock": 25,
    "isDigital": false,
    "shipping": {
      "freeShipping": true,
      "estimatedDays": { "min": 5, "max": 10 }
    },
    "reviews": [
      {
        "id": "rev_001",
        "userId": "usr_buyer1",
        "userName": "Ana Costa",
        "rating": 5,
        "comment": "Qualidade incrível! As cartas são lindas.",
        "createdAt": "2025-01-12T14:00:00Z"
      }
    ],
    "createdAt": "2025-01-10T00:00:00Z",
    "updatedAt": "2025-01-14T18:00:00Z"
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `PRODUCT_NOT_FOUND` | Produto não encontrado |

---

## POST /marketplace/products

Cria um novo produto (apenas vendedores autorizados).

### Requisição

```http
POST /api/v1/marketplace/products
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "name": "Pendulo de Cristal de Quartzo Rosa",
  "description": "Pêndulo em cristal natural de quartzo rosa com corrente prateada de 20cm. Ideal para perguntas de amor e emocionais.",
  "category": "acessorio",
  "price": 79.90,
  "compareAtPrice": 99.90,
  "stock": 50,
  "isDigital": false,
  "specifications": [
    { "label": "Material", "value": "Quartzo rosa natural" },
    { "label": "Comprimento da corrente", "value": "20cm" },
    { "label": "Peso do pêndulo", "value": "15g" }
  ],
  "shipping": {
    "freeShipping": true,
    "estimatedDays": { "min": 3, "max": 7 }
  }
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `name` | string | Sim | 3–200 caracteres |
| `description` | string | Sim | 20–2000 caracteres |
| `category` | string | Sim | Categoria válida |
| `price` | number | Sim | R$ 1,00 – R$ 99.999,00 |
| `stock` | number | Sim | 0–10.000 |
| `isDigital` | boolean | Não | Padrão: `false` |

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 403 | `SELLER_NOT_AUTHORIZED` | Usuário não é vendedor autorizado |
| 400 | `VALIDATION_ERROR` | Dados inválidos |

---

## PATCH /marketplace/products/:id

Atualiza um produto existente.

### Requisição

```http
PATCH /api/v1/marketplace/products/prod_a1b2
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "price": 119.90,
  "stock": 20,
  "description": "Nova descrição atualizada..."
}
```

> Apenas campos enviados são atualizados (partial update).

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 403 | `PRODUCT_OWNERSHIP_DENIED` | Não é dono do produto |
| 404 | `PRODUCT_NOT_FOUND` | Produto não encontrado |

---

## DELETE /marketplace/products/:id

Remove um produto do marketplace.

### Requisição

```http
DELETE /api/v1/marketplace/products/prod_a1b2
Authorization: Bearer <accessToken>
```

### Comportamento

- Produto é marcado como `deleted` (soft delete)
- Pedidos em andamento **não** são afetados
- Vendedor pode reativar em até 30 dias

### Resposta — 200 OK

```json
{
  "data": {
    "message": "Produto removido. Você pode reativá-lo em até 30 dias.",
    "reactivableUntil": "2025-02-14T10:30:00Z"
  }
}
```

---

## POST /marketplace/orders

Cria um novo pedido (inicia checkout Mercado Pago).

### Requisição

```http
POST /api/v1/marketplace/orders
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "items": [
    { "productId": "prod_a1b2", "quantity": 1 },
    { "productId": "prod_c3d4", "quantity": 2 }
  ],
  "shippingAddress": {
    "street": "Rua das Flores",
    "number": "123",
    "complement": "Apto 45",
    "neighborhood": "Jardim Primavera",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01234-567"
  },
  "paymentMethod": "pix"
}
```

### Resposta — 201 Created

```json
{
  "data": {
    "order": {
      "id": "ord_xyz789",
      "items": [
        {
          "productId": "prod_a1b2",
          "name": "Baralho Tarot Rider-Waite Edição Especial",
          "quantity": 1,
          "unitPrice": 129.90,
          "total": 129.90
        },
        {
          "productId": "prod_c3d4",
          "name": "Pendulo de Quartzo Rosa",
          "quantity": 2,
          "unitPrice": 79.90,
          "total": 159.80
        }
      ],
      "subtotal": 289.70,
      "shipping": 0,
      "total": 289.70,
      "status": "pending_payment",
      "payment": {
        "provider": "mercadopago",
        "method": "pix",
        "pixCode": "00020126580014br.gov.bcb.pix...",
        "pixQrCodeUrl": "https://api.mercadopago.com/v1/payments/.../qr",
        "expiresAt": "2025-01-15T11:00:00Z"
      },
      "createdAt": "2025-01-15T10:30:00Z"
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `VALIDATION_ERROR` | Dados inválidos |
| 404 | `PRODUCT_NOT_FOUND` | Produto não encontrado |
| 409 | `INSUFFICIENT_STOCK` | Estoque insuficiente |

---

## GET /marketplace/orders

Lista pedidos do usuário autenticado.

### Requisição

```http
GET /api/v1/marketplace/orders?status=shipped&page=1&limit=10
Authorization: Bearer <accessToken>
```

### Parâmetros de Query

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `status` | string | Filtrar: `pending_payment`, `paid`, `processing`, `shipped`, `delivered`, `cancelled` |
| `page` | number | Página atual |
| `limit` | number | Itens por página |

### Resposta — 200 OK

```json
{
  "data": [
    {
      "id": "ord_xyz789",
      "items": [
        { "productId": "prod_a1b2", "name": "Baralho Tarot", "quantity": 1, "total": 129.90 }
      ],
      "total": 289.70,
      "status": "shipped",
      "trackingCode": "BR123456789XX",
      "createdAt": "2025-01-10T15:00:00Z",
      "updatedAt": "2025-01-12T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 8,
    "totalPages": 1
  }
}
```

---

## GET /marketplace/orders/:id

Retorna detalhe completo de um pedido.

### Requisição

```http
GET /api/v1/marketplace/orders/ord_xyz789
Authorization: Bearer <accessToken>
```

### Resposta — 200 OK

```json
{
  "data": {
    "id": "ord_xyz789",
    "items": [
      {
        "productId": "prod_a1b2",
        "name": "Baralho Tarot Rider-Waite",
        "quantity": 1,
        "unitPrice": 129.90,
        "total": 129.90,
        "imageUrl": "/products/prod_a1b2/img1.jpg"
      }
    ],
    "subtotal": 289.70,
    "shipping": { "cost": 0, "method": "PAC", "estimatedDays": { "min": 5, "max": 10 } },
    "total": 289.70,
    "status": "shipped",
    "statusHistory": [
      { "status": "pending_payment", "timestamp": "2025-01-10T15:00:00Z" },
      { "status": "paid", "timestamp": "2025-01-10T15:02:00Z" },
      { "status": "processing", "timestamp": "2025-01-11T10:00:00Z" },
      { "status": "shipped", "timestamp": "2025-01-12T09:00:00Z" }
    ],
    "payment": {
      "provider": "mercadopago",
      "method": "pix",
      "paidAt": "2025-01-10T15:02:00Z"
    },
    "shippingAddress": {
      "street": "Rua das Flores",
      "number": "123",
      "complement": "Apto 45",
      "neighborhood": "Jardim Primavera",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01234-567"
    },
    "trackingCode": "BR123456789XX",
    "seller": {
      "id": "usr_seller1",
      "name": "Mística Store",
      "avatar": "/avatars/usr_seller1.jpg"
    },
    "canReview": true,
    "createdAt": "2025-01-10T15:00:00Z",
    "updatedAt": "2025-01-12T09:00:00Z"
  }
}
```

---

## POST /marketplace/reviews

Cria avaliação de um produto/pedido.

### Requisição

```http
POST /api/v1/marketplace/reviews
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "orderId": "ord_xyz789",
  "productId": "prod_a1b2",
  "rating": 5,
  "comment": "Qualidade incrível! Cartas lindas e entrega rápida."
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `orderId` | string | Sim | Pedido do usuário com status `delivered` |
| `productId` | string | Sim | Produto do pedido |
| `rating` | number | Sim | 1–5 (inteiro) |
| `comment` | string | Não | 5–500 caracteres |

### Resposta — 201 Created

```json
{
  "data": {
    "review": {
      "id": "rev_002",
      "orderId": "ord_xyz789",
      "productId": "prod_a1b2",
      "userId": "usr_a1b2c3d4",
      "userName": "Maria Silva",
      "rating": 5,
      "comment": "Qualidade incrível! Cartas lindas e entrega rápida.",
      "createdAt": "2025-01-15T14:00:00Z"
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `VALIDATION_ERROR` | Dados inválidos |
| 409 | `REVIEW_ALREADY_EXISTS` | Pedido já avaliado |
| 403 | `ORDER_NOT_DELIVERED` | Pedido ainda não entregue |

---

## GET /marketplace/sellers/:id

Retorna o perfil público de um vendedor.

### Requisição

```http
GET /api/v1/marketplace/sellers/usr_seller1
```

### Resposta — 200 OK

```json
{
  "data": {
    "id": "usr_seller1",
    "name": "Mística Store",
    "avatar": "/avatars/usr_seller1.jpg",
    "bio": "Loja especializada em produtos esotéricos premium desde 2020",
    "rating": 4.8,
    "totalSales": 1200,
    "totalProducts": 45,
    "topProducts": [
      {
        "id": "prod_a1b2",
        "name": "Baralho Tarot Rider-Waite",
        "price": 129.90,
        "rating": 4.7,
        "imageUrl": "/products/prod_a1b2/img1.jpg"
      }
    ],
    "memberSince": "2024-03-01T00:00:00Z"
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `SELLER_NOT_FOUND` | Vendedor não encontrado |
