# SPEC-008: Marketplace -- Tarefas

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## Tarefas de Implementacao

### Infraestrutura e Dados

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 1 | Criar schema Prisma: Product, ProductImage, Category, ProductReview, Dispute, Order, OrderItem | pending | 3 | - |
| 2 | Criar seed de categorias e subcategorias | pending | 1.5 | 1 |
| 3 | Criar indice full-text no PostgreSQL para produtos | pending | 1 | 1 |
| 4 | Configurar bucket R2 para imagens de produto | pending | 1 | - |

### Backend - Produtos

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 5 | Implementar CRUD de produtos (POST, GET, PATCH, DELETE) | pending | 4 | 1 |
| 6 | Implementar upload de imagens de produto (presign + confirm) | pending | 2 | 4 |
| 7 | Implementar busca com filtros e full-text search | pending | 3 | 3, 5 |
| 8 | Implementar sistema de avaliacoes e reviews | pending | 2.5 | 1 |
| 9 | Implementar resposta do vendedor a review | pending | 1 | 8 |

### Backend - Pedidos e Disputas

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 10 | Implementar criacao de pedido (vinculado ao pagamento) | pending | 2 | 1, SPEC-009 |
| 11 | Implementar atualizacao de status do pedido | pending | 1.5 | 10 |
| 12 | Implementar fluxo de disputas (abrir, mensagens, resolver) | pending | 3 | 1 |

### Backend - Vendedor

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 13 | Implementar GET /seller/dashboard (estatisticas de vendas) | pending | 2.5 | 10 |
| 14 | Implementar GET /seller/reports/sales (relatorio por periodo) | pending | 2 | 13 |

### Frontend - Comprador

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 15 | Criar componente MarketplacePage com grid, filtros e busca | pending | 3.5 | 7 |
| 16 | Criar componente ProductCard com carousel e badges | pending | 2.5 | 5 |
| 17 | Criar componente ProductDetailPage com galeria e reviews | pending | 4 | 8, 16 |
| 18 | Criar componente de filtro lateral com sliders e checkboxes | pending | 2 | 15 |

### Frontend - Vendedor

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 19 | Criar componente ProductForm com steps e upload de imagens | pending | 4 | 5, 6 |
| 20 | Criar componente SellerDashboard com cards e grafico | pending | 3 | 13 |
| 21 | Criar componente SellerOrdersPage com tabela e filtros | pending | 2.5 | 11 |
| 22 | Criar componente DisputeForm e timeline | pending | 2.5 | 12 |

### Testes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 23 | Criar testes de integracao para CRUD de produtos | pending | 2 | 5 |
| 24 | Criar testes de integracao para busca e filtros | pending | 2 | 7 |
| 25 | Criar testes de integracao para disputas | pending | 2 | 12 |
| 26 | Criar testes E2E de fluxo completo de compra | pending | 3 | 10, 17 |

---

## Resumo

| Categoria | Total de Tarefas | Horas Estimadas |
|---|---|---|
| Infraestrutura e Dados | 4 | 6.5h |
| Backend - Produtos | 5 | 12.5h |
| Backend - Pedidos e Disputas | 3 | 6.5h |
| Backend - Vendedor | 2 | 4.5h |
| Frontend - Comprador | 4 | 12h |
| Frontend - Vendedor | 4 | 12h |
| Testes | 4 | 9h |
| **TOTAL** | **26** | **63h** |

---

## Ordem Recomendada de Execucao

1. Tarefas 1-4 (infraestrutura)
2. Tarefas 5-6 (CRUD de produtos e imagens)
3. Tarefa 7 (busca)
4. Tarefas 8-9 (reviews)
5. Tarefas 10-11 (pedidos)
6. Tarefa 12 (disputas)
7. Tarefas 13-14 (vendedor backend)
8. Tarefas 16, 18 (ProductCard, filtros)
9. Tarefa 15 (MarketplacePage)
10. Tarefa 17 (ProductDetailPage)
11. Tarefas 19 (ProductForm)
12. Tarefas 20-21 (SellerDashboard, Orders)
13. Tarefa 22 (DisputeForm)
14. Tarefas 23-26 (testes)
