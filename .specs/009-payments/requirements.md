# SPEC-009: Pagamentos e Assinaturas

**Plataforma**: Arkana Agora
**Versao**: MVP
**Status**: Pendente
**Data**: 2025-01-01

---

## 1. Visao Geral

Este documento define os requisitos do sistema de pagamentos e assinaturas do Arkana Agora. A plataforma utiliza o Mercado Pago como gateway de pagamento, suportando PIX, cartao de credito e boleto bancario para assinaturas do plano Plus e compras no marketplace.

---

## 2. Requisitos Funcionais

### RF-PAY-001: Metodos de Pagamento via Mercado Pago
O sistema deve aceitar os seguintes metodos de pagamento:

**PIX:**
- Gerar QR Code PIX via API do Mercado Pago
- QR Code exibido na tela com countdown de 30 minutos para pagamento
- Webhook de confirmacao: o plano e ativado assim que o PIX e compensado (instantaneo)
- Copy-paste do codigo PIX para apps de banco

**Cartao de Credito:**
- Aceitar Visa, Mastercard, Elo, American Express, Hipercard
- Formulario de cartao integrado (Mercado Pago SDK) com tokenizacao
- Parcelamento: ate 12x (apenas para assinaturas anual e marketplace)
- Parcela minima: R$ 5,00
- Retencao do cartao para renovacao automatica da assinatura
- 3DS2 para transacoes acima de R$ 100 (quando disponivel via Mercado Pago)

**Boleto Bancario:**
- Gerar boleto via API do Mercado Pago
- Validade do boleto: 3 dias uteis
- Webhook de confirmacao: plano ativado apos compensacao (D+1 a D+3)
- Exibir codigo de barras e linha digitavel
- Opcao de download em PDF
- Pagamento minimo via boleto: R$ 10,00

### RF-PAY-002: Gestao de Assinaturas
O sistema deve gerenciar o ciclo de vida completo das assinaturas:

**Planos disponiveis:**

| Feature | Free | Plus |
|---|---|---|
| Preco | R$ 0 | R$ 19,90/mes ou R$ 179,90/ano (25% desconto) |
| Tiragens diarias | 3 | 10 |
| Interpretacoes IA diarias | 10 | Ilimitadas |
| Follow-up chat | 10 msg | 30 msg |
| Leituras compartilhadas | 5 | Ilimitadas |
| Horoscopo IA detalhado | Nao | Sim |
| Marketplace (vendedor) | Nao | Sim (ate 100 produtos) |
| Perfil profissional | Nao | Sim |
| Sem anuncios | Nao | Sim |

**Ciclo de vida:**
- **Ativa**: assinatura paga e vigente
- **Vencida**: data de vencimento passou, pagamento pendente
- **Cancelada**: usuario cancelou manualmente (permanece ativa ate o fim do periodo pago)
- **Inadimplente**: tentativa de renovacao falhou (grace period de 7 dias)
- **Expirada**: apos grace period sem pagamento

### RF-PAY-003: Historico de Cobrancas
O usuario deve poder visualizar o historico completo de cobranças:
- Lista paginada de todas as transacoes (assinaturas e compras)
- Cada item: data, descricao, valor, status (pago, pendente, cancelado, estornado)
- Detalhe da transacao: ID do Mercado Pago, metodo de pagamento, parcelas
- Opcao de download de recibo em PDF
- Filtros: periodo, status, tipo (assinatura, compra)

### RF-PAY-004: Recibos
O sistema deve gerar recibos para todas as transacoes concluidas:
- Recibo em PDF com: logotipo do Arkana Agora, dados do usuario, descricao, valor, metodo, data, ID da transacao
- Link para download permanente
- Envio automatico por email apos cada pagamento confirmado
- Conformidade com requisitos fiscais brasileiros (nota fiscal, se aplicavel)

### RF-PAY-005: Reembolsos
O sistema deve suportar fluxo de reembolso:
- **Reembolso total ou parcial** de qualquer transacao em ate 7 dias
- Solicitacao feita pelo usuario na pagina de detalhes da transacao
- Motivo obrigatorio: nao reconheco a compra, produto nao recebido, insatisfeito, outro
- Reembolso processado via API do Mercado Pago (refund)
- Prazo de estorno: PIX ate 5 dias uteis, cartao ate 2 faturas, boleto ate 10 dias uteis
- Notificacao ao usuario sobre o status do reembolso
- Reembolso de assinatura: plano volta para Free, acesso Plus mantido ate o fim do periodo pago

### RF-PAY-006: Plano Plus e Upgrade
O sistema deve oferecer um fluxo de upgrade bem definido:
- **Pagina de precos**: comparacao visual Free vs Plus com CTA
- **Checkout**: fluxo de pagamento integrado (sem redirecionamento externo)
- **Onboarding Plus**: ao ativar o plano, exibir tutorial das funcionalidades desbloqueadas
- **Downgrade**: ao cancelar, o usuario mantem o acesso ate o fim do periodo pago
- **Reativacao**: apos cancelamento, reativar com desconto de 10% (1 unica vez)
- **Trial**: 7 dias gratis para novos usuarios (requiere cartao no cadastro)

---

## 3. Requisitos Nao Funcionais

### RNF-PAY-001: Seguranca de Dados de Pagamento
Nunca armazenar dados completos de cartao de credito no servidor. Utilizar exclusivamente a tokenizacao do Mercado Pago. O token gerado pelo SDK e o unico dado armazenado (nao e o numero do cartao).

### RNF-PAY-002: Idempotencia de Webhooks
Todos os webhooks do Mercado Pago devem ser processados de forma idempotente. Utilizar o campo `id` do webhook como chave de deduplicacao. O mesmo webhook pode ser recebido multiplas vezes.

### RNF-PAY-003: Disponibilidade
O sistema de webhooks deve ter 99.9% de disponibilidade. Webhooks com falha devem ser retentados automaticamente pelo Mercado Pago conforme sua politica de retry.

---

## 4. Dependencias

| Dependencia | Versao | Proposito |
|---|---|---|
| Mercado Pago SDK | v2 | Gateway de pagamento, assinaturas, webhooks |
| Mercado Pago JS SDK | - | Tokenizacao de cartao no frontend |
| Puppeteer / Playwright | - | Geracao de recibos em PDF |

---

## 5. Criterios de Aceite

| ID | Criterio | Metodo de Validacao |
|---|---|---|
| CA-PAY-001 | O usuario conclui o pagamento via PIX, o webhook confirma o pagamento e o plano Plus e ativado | Teste E2E com sandbox do Mercado Pago |
| CA-PAY-002 | O usuario paga com cartao parcelado em 3x; o historico exibe 3 parcelas com datas de vencimento | Teste de integracao |
| CA-PAY-003 | O usuario solicita reembolso e o valor e estornado via API do Mercado Pago | Teste de integracao com sandbox |
| CA-PAY-004 | O recibo em PDF e gerado com todos os dados obrigatorios e e enviado por email | Teste de integracao |