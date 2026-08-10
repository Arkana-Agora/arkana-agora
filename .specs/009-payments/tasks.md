# SPEC-009: Pagamentos e Assinaturas -- Tarefas

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## Tarefas de Implementacao

### Configuracao

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 1 | Criar conta e configurar aplicacao no Mercado Pago Dashboard (sandbox + producao) | pending | 2 | - |
| 2 | Instalar e configurar Mercado Pago SDK v2 (server) | pending | 1.5 | 1 |
| 3 | Criar schema Prisma: Subscription, Transaction, WebhookLog | pending | 1.5 | - |
| 4 | Definir constantes de planos (PLANS) com precos e features | pending | 0.5 | - |

### Backend - Checkout e Assinaturas

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 5 | Implementar POST /api/v1/payments/checkout (criar preferencia MP) | pending | 3 | 2, 3, 4 |
| 6 | Implementar POST /api/v1/webhooks/mercadopago (processamento idempotente) | pending | 4 | 3 |
| 7 | Implementar ativacao de assinatura no webhook (atualizar User.role) | pending | 2 | 6 |
| 8 | Implementar POST /api/v1/payments/subscriptions/cancel | pending | 1.5 | 3 |
| 9 | Implementar POST /api/v1/payments/subscriptions/reactivate | pending | 1 | 8 |
| 10 | Implementar job de verificacao de assinaturas vencidas (cron diario) | pending | 2 | 3 |

### Backend - Historico e Reembolso

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 11 | Implementar GET /api/v1/payments/history | pending | 1.5 | 3 |
| 12 | Implementar GET /api/v1/payments/subscriptions | pending | 1 | 3 |
| 13 | Implementar POST /api/v1/payments/transactions/:id/refund | pending | 2 | 3 |
| 14 | Implementar GET /api/v1/payments/transactions/:id/receipt (geracao PDF) | pending | 3 | 3 |
| 15 | Implementar envio de email de confirmacao de pagamento | pending | 1 | 7 |

### Frontend

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 16 | Criar componente PricingPage com comparacao Free vs Plus | pending | 2.5 | 4 |
| 17 | Criar componente CheckoutPage com 3 etapas (resumo, pagamento, confirmacao) | pending | 4 | 5 |
| 18 | Integrar Mercado Pago JS SDK no formulario de cartao | pending | 2.5 | 17 |
| 19 | Criar componente de exibicao de PIX QR Code | pending | 2 | 17 |
| 20 | Criar componente de exibicao de boleto | pending | 1.5 | 17 |
| 21 | Criar componente BillingPage com tabs (assinatura, historico, metodos) | pending | 3 | 11, 12 |
| 22 | Criar componente ReceiptPage (visualizacao e download) | pending | 2 | 14 |

### Testes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 23 | Criar testes de integracao para webhook processing (idempotencia) | pending | 2.5 | 6 |
| 24 | Criar testes de integracao para checkout (PIX, cartao, boleto) | pending | 2 | 5 |
| 25 | Criar testes E2E de fluxo completo de assinatura | pending | 3 | 16-22 |

---

## Resumo

| Categoria | Total de Tarefas | Horas Estimadas |
|---|---|---|
| Configuracao | 4 | 5.5h |
| Backend - Checkout e Assinaturas | 6 | 13.5h |
| Backend - Historico e Reembolso | 5 | 8.5h |
| Frontend | 7 | 17.5h |
| Testes | 3 | 7.5h |
| **TOTAL** | **25** | **52.5h** |

---

## Ordem Recomendada de Execucao

1. Tarefas 1-4 (configuracao e schema)
2. Tarefa 5 (endpoint de checkout)
3. Tarefa 6 (webhooks)
4. Tarefa 7 (ativacao de assinatura)
5. Tarefas 8-10 (cancelar, reativar, cron)
6. Tarefa 15 (email de confirmacao)
7. Tarefas 11-14 (historico, reembolso, recibo)
8. Tarefas 16 (PricingPage)
9. Tarefas 17-20 (CheckoutPage com metodos de pagamento)
10. Tarefas 21-22 (BillingPage, ReceiptPage)
11. Tarefas 23-25 (testes)