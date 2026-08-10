# SPEC-009: Pagamentos e Assinaturas -- Design Tecnico

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## 1. Componentes de Interface

### 1.1 PricingPage
- Pagina `/planos` com comparacao visual dos planos
- Dois cards: Free e Plus
- Destaque no card Plus (borda dourada, badge "Mais Popular")
- Toggle mensal/anual com economia exibida ("Economize R$ 59,90/ano")
- Lista de features com checkmarks (verde) e x-marks (cinza)
- CTA: "Assinar agora" (Plus) ou "Plano atual" (se ja Plus)
- Secao de FAQ sobre pagamento
- Secao de depoimentos (opcional)

### 1.2 CheckoutPage
- Fluxo de checkout em 3 etapas:
  1. **Resumo**: plano selecionado, valor, ciclo (mensal/anual)
  2. **Pagamento**: selecao do metodo (PIX, cartao, boleto) + formulario
  3. **Confirmacao**: processando -> aprovado/rejeitado
- SDK do Mercado Pago integrado inline (sem iframe externo)
- Para PIX: exibicao do QR Code + countdown de 30min + botao "Ja paguei"
- Para boleto: exibicao do codigo de barras + link para PDF
- Para cartao: formulario com numero, validade, CVV, nome + bandeira detectada
- Indicador de seguranca (cadeado, "Pagamento seguro via Mercado Pago")

### 1.3 BillingPage
- Tab navigation: Assinatura | Historico | Metodos de Pagamento
- Tab Assinatura: plano atual, proxima cobranca, botao cancelar, reativar
- Tab Historico: tabela paginada com todas as transacoes
- Tab Metodos: cartoes salvos (tokenizados), botao adicionar

### 1.4 ReceiptPage
- Visualizacao do recibo em formato para impressao
- Botao de download em PDF
- Botao de envio por email
- Layout limpo com dados da transacao

---

## 2. Fluxo de Pagamento

```
    FLUXO DE ASSINATURA
    =====================

    [1] Usuario clica "Assinar Plus"
         |
         v
    [2] POST /api/v1/payments/checkout
         |  Body: { plan: 'plus', cycle: 'monthly'|'annual' }
         |  Header: Authorization: Bearer <token>
         v
    [3] Server cria preferencia no Mercado Pago
         |  -> preferenceId, init_point
         |  -> Salva Subscription no banco (status: pending)
         v
    [4] Retorna { preferenceId, plan, cycle, amount }
         |
         v
    [5] Cliente inicializa Mercado Pago SDK
         |  -> Se cartao: renderiza formulario de cartao
         |  -> Se PIX: gera QR Code
         |  -> Se boleto: gera boleto
         v
    [6] Usuario realiza pagamento
         |
         v
    [7] Mercado Pago envia webhook
         |  POST /api/v1/webhooks/mercadopago
         |  { type: 'payment', data: { id: '123' } }
         v
    [8] Server valida e processa webhook
         |  -> Busca pagamento no Mercado Pago
         |  -> Se aprovado:
         |     - Atualiza Subscription (status: active)
         |     - Atualiza User.role = 'plus'
         |     - Envia email de confirmacao
         |     - Invalida cache do usuario
         v
    [9] Cliente polla status ou recebe via WebSocket
         |  -> Redireciona para tela de confirmacao
         v
    [10] Tela: "Parabens! Agora voce e Plus."
          -> Onboarding das funcionalidades
```

---

## 3. API Endpoints

### POST /api/v1/payments/checkout
**Descricao**: Cria uma sessao de checkout.
**Body**: `{ plan: 'plus', cycle: 'monthly'|'annual', paymentMethod: 'pix'|'credit_card'|'boleto', cardToken?, installments? }`
**Response 201**: `{ subscriptionId, preferenceId, paymentData: { pixQrCode?, boletoUrl?, cardLastDigits? } }`

### POST /api/v1/webhooks/mercadopago
**Descricao**: Recebe webhooks do Mercado Pago (nao requer auth).
**Body**: (payload do Mercado Pago)
**Response 200**: `{ received: true }`

### GET /api/v1/payments/subscriptions
**Descricao**: Retorna a assinatura atual do usuario.
**Response 200**: `{ subscription: Subscription }`

### POST /api/v1/payments/subscriptions/cancel
**Descricao**: Cancela a assinatura (mantem acesso ate o fim do periodo).
**Response 200**: `{ message: "Assinatura cancelada. Acesso Plus ate DD/MM/AAAA." }`

### POST /api/v1/payments/subscriptions/reactivate
**Descricao**: Reativa uma assinatura cancelada.
**Response 200**: `{ subscription: Subscription }`

### GET /api/v1/payments/history?page=1&limit=20
**Descricao**: Historico de transacoes do usuario.
**Response 200**: `{ transactions: Transaction[], pagination }`

### GET /api/v1/payments/transactions/:id/receipt
**Descricao**: Gera e retorna recibo em PDF.
**Response 200**: `application/pdf`

### POST /api/v1/payments/transactions/:id/refund
**Descricao**: Solicita reembolso.
**Body**: `{ reason: string, amount?: number }`
**Response 200**: `{ refundId, status, estimatedRefundDate }`

---

## 4. Database Schema

```prisma
model Subscription {
  id              String   @id @default(cuid())
  userId          String   @unique
  plan            String   @default('free') // 'free' | 'plus'
  cycle           String?  // 'monthly' | 'annual'
  status          String   @default('inactive') // 'active'|'past_due'|'cancelled'|'in_grace'|'expired'
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  cancelledAt     DateTime?
  cancelReason    String?
  mpSubscriptionId String?  @unique // ID da assinatura no Mercado Pago
  mpPreferenceld  String?
  trialEndsAt     DateTime? // para trial de 7 dias
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions    Transaction[]

  @@map('subscriptions')
}

model Transaction {
  id              String   @id @default(cuid())
  userId          String
  subscriptionId  String?
  mpPaymentId     String   @unique // ID do pagamento no Mercado Pago
  type            String   // 'subscription' | 'marketplace_purchase' | 'gift_coins'
  description     String
  amount          Int      // em centavos
  currency        String   @default('BRL')
  paymentMethod   String   // 'pix' | 'credit_card' | 'boleto'
  status          String   // 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled'
  installments    Int?
  cardLastDigits  String?
  cardBrand       String?
  approvedAt      DateTime?
  refundedAt      DateTime?
  refundAmount    Int?
  metadata        Json?
  createdAt       DateTime @default(now())

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  subscription    Subscription? @relation(fields: [subscriptionId], references: [id])

  @@index([userId, createdAt])
  @@map('transactions')
}

model WebhookLog {
  id              String   @id @default(cuid())
  mpId            String   @unique // ID do webhook do Mercado Pago
  type            String
  payload         Json
  processed       Boolean  @default(false)
  processedAt     DateTime?
  createdAt       DateTime @default(now())

  @@map('webhook_logs')
}
```

---

## 5. Tratamento de Webhooks

```typescript
// app/api/v1/webhooks/mercadopago/route.ts

async function handleWebhook(payload: any) {
  // 1. Deduplicacao: verificar se ja processamos este webhook
  const existing = await prisma.webhookLog.findUnique({
    where: { mpId: payload.id },
  });
  if (existing?.processed) return { status: 'already_processed' };

  // 2. Logar o webhook
  await prisma.webhookLog.upsert({
    where: { mpId: payload.id },
    create: { mpId: payload.id, type: payload.type, payload },
    update: { payload },
  });

  // 3. Processar baseado no tipo
  if (payload.type === 'payment') {
    const paymentId = payload.data.id;
    const payment = await mpClient.payment.get(paymentId);

    // Buscar transacao local
    const transaction = await prisma.transaction.findUnique({
      where: { mpPaymentId: String(paymentId) },
    });

    if (!transaction) return { status: 'not_found' };

    // Atualizar status
    if (payment.status === 'approved') {
      await prisma.$transaction([
        prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'approved', approvedAt: new Date() },
        }),
        // Se for assinatura, ativar
        ...(transaction.subscriptionId ? [
          prisma.subscription.update({
            where: { id: transaction.subscriptionId },
            data: {
              status: 'active',
              currentPeriodStart: new Date(),
              currentPeriodEnd: getNextPeriodDate(new Date()),
            },
          }),
          prisma.user.update({
            where: { id: transaction.userId },
            data: { role: 'plus' },
          }),
        ] : []),
      ]);

      // Enviar email de confirmacao
      await sendPaymentConfirmationEmail(transaction.userId, transaction);
    }
  }

  // 4. Marcar como processado
  await prisma.webhookLog.update({
    where: { mpId: payload.id },
    data: { processed: true, processedAt: new Date() },
  });
}
```

---

## 6. Precos e Configuracao

```typescript
const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    features: {
      dailyReadings: 3,
      dailyAIReadings: 10,
      followUpMessages: 10,
      sharedReadings: 5,
      horoscopeAI: false,
      marketplaceSeller: false,
      proProfile: false,
      adFree: false,
    },
  },
  plus: {
    name: 'Plus',
    priceMonthly: 1990,    // R$ 19,90 em centavos
    priceAnnual: 17990,   // R$ 179,90 em centavos
    discountAnnual: 0.25,  // 25% de desconto
    features: {
      dailyReadings: Infinity,
      dailyAIReadings: Infinity,
      followUpMessages: 30,
      sharedReadings: Infinity,
      horoscopeAI: true,
      marketplaceSeller: true,
      proProfile: true,
      adFree: true,
    },
  },
};
```

---

## 7. Rotas da Aplicacao

| Rota | Componente | Protegida | Descricao |
|---|---|---|---|
| `/planos` | PricingPage | Nao | Comparacao de planos |
| `/checkout` | CheckoutPage | Sim | Fluxo de pagamento |
| `/pagamentos` | BillingPage | Sim | Gerenciamento de pagamentos |
| `/pagamentos/historico` | HistoryPage | Sim | Historico detalhado |
| `/pagamentos/recibo/:id` | ReceiptPage | Sim | Visualizacao de recibo |