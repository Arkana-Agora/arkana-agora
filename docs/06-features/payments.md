# Pagamentos — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Pagamentos | **Versão**: MVP (assinatura) / V1 (marketplace)

---

## Descrição

O módulo de Pagamentos do **Arkana Agora** é o sistema financeiro central da plataforma, processando todas as transações através da integração com o **Mercado Pago**. O módulo cobre dois fluxos principais: **assinaturas** do plano Akasha Plus e **transações pontuais** do Marketplace (compra de produtos, consultas e presentes). Todas as transações são processadas em Reais (BRL) com suporte a PIX, cartão de crédito e boleto bancário.

O plano Akasha Plus oferece leituras ilimitadas, tiragens premium, interpretações IA avançadas e acesso antecipado a novos recursos. O sistema de gestão de assinaturas controla renovações, cancelamentos e reativações, com período de teste de 7 dias para novos assinantes. O histórico de cobranças e a geração de recibos ficam disponíveis na área de configurações do usuário. A política de reembolso prevê devolução integral em até 7 dias para assinaturas e análise caso a caso para produtos do Marketplace.

---

## Planos Akasha Plus

| Recurso | Gratuito | Plus (R$ 19,90/mês) |
|---|---|---|
| Leituras por dia | 3 | Ilimitadas |
| Tiragens disponíveis | Simples (1, 3, Sim/Não) | Todas (Cruz Celta, Amor, GT) |
| Interpretação IA | Básica | Avançada com contexto |
| Tarot Diário | Sim | Sim (interpretação estendida) |
| Compartilhamento | Com marca d'água | Sem marca d'água |
| Lenormand | Não | Sim |
| Itens de inventário | Limitados | Desbloqueio completo |
| Marketplace (compra) | Sim | 10% de desconto |
| Presentes | Receber | Enviar e receber |
| Suporte | Comunidade | Prioritário |

---

## Funcionalidades

- **Integração Mercado Pago** (PIX, cartão de crédito até 12x, boleto)
- **Gestão de assinaturas** Akasha Plus (ativação, renovação, cancelamento, reativação)
- **Período de teste** de 7 dias (não requer cartão)
- **Checkout simplificado** para transações pontuais do Marketplace
- **Histórico de cobranças** com detalhes e recibos em PDF
- **Geração de recibos** automáticos a cada transação
- **Política de reembolso** com fluxo automatizado para assinaturas
- **Gestão de formas de pagamento** salvas (cartões)
- **Parcelamento** em até 12x no cartão de crédito
- **Desconto de 10% no Marketplace** para assinantes Plus

---

## Fluxo Principal — Assinatura

1. O usuário acessa a página de planos pelo menu ou banner
2. Visualiza a comparação entre Gratuito e Plus
3. Clica em "Assinar Plus" e inicia o período de teste de 7 dias
4. Opcionalmente, cadastra uma forma de pagamento para continuidade após o trial
5. O sistema cria a assinatura no Mercado Pago com data de vencimento
6. O acesso Plus é liberado imediatamente
7. O usuário pode cancelar a qualquer momento, mantendo o acesso até o final do período pago
8. Em caso de falha na cobrança, o sistema tenta 3 vezes em 7 dias antes de cancelar

## Fluxo Principal — Marketplace

1. O usuário seleciona um produto e clica em "Comprar"
2. O checkout exibe o valor e as formas de pagamento disponíveis
3. O usuário seleciona PIX, cartão ou boleto
4. O sistema cria a preferência de pagamento no Mercado Pago
5. O usuário é redirecionado ao gateway de pagamento
6. Após confirmação, o produto é liberado (digital) ou pedido criado (físico)
7. O vendedor é notificado e a comissão é distribuída

---

## Versão

| Feature | Versão |
|---|---|
| Assinatura Akasha Plus (trial + cobrança) | MVP |
| Checkout Marketplace via PIX | V1 |
| Checkout Marketplace via cartão/boleto | V1 |
| Histórico de cobranças e recibos | V1 |
| Formas de pagamento salvas | V1 |
| Desconto Plus no Marketplace | V1 |
| Reembolso automatizado | V2 |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| Autenticação | Módulo interno | Usuário autenticado |
| Marketplace | Módulo interno | Transações de compra |
| Profissionais | Módulo interno | Repartição de receita |
| Presentes | Módulo interno | Compra de Versos |
| Notificações | Módulo interno | Confirmação de pagamento |
| **Mercado Pago SDK** | **API externa** | Processamento de pagamentos (PIX, cartão, boleto) |

> ⚠️ **Dependência Externa Crítica**: O módulo depende integralmente do Mercado Pago SDK. Falhas na API do Mercado Pago impactam diretamente todas as transações financeiras da plataforma.

---

## Critérios de Aceite

- **CA-01**: O pagamento via PIX deve ser gerado em menos de 3 segundos e a confirmação deve ocorrer em menos de 2 minutos após a transação
- **CA-02**: A ativação do plano Plus deve ser instantânea após a confirmação do pagamento ou início do trial
- **CA-03**: O cancelamento da assinatura deve manter o acesso Plus até o final do período pago já cobrado
- **CA-04**: O recibo em PDF deve ser gerado em menos de 5 segundos e conter todos os dados fiscais obrigatórios
- **CA-05**: Em caso de falha de cobrança, o sistema deve notificar o usuário em até 24 horas e tentar a cobrança novamente em até 3 vezes