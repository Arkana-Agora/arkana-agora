# Sistema de Presentes — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Sistema de Presentes | **Versão**: V1
>
> **Status (2026-09-26)**: **parcialmente implementado (Sprint 2 Phase 0.5).** O model `Gift` existe no schema desde o Sprint 2 Phase 0 (`fromUserId`, `toUserId`, `giftId`, `coinCost`, `recipientEarnsHalf`) e o **catálogo fixo SPEC-007 está em `src/lib/social/gifts.ts`** (T036: `GIFT_CATALOG` com `id` kebab-case + `getGiftCost()`/`validateGiftId()`/`getGiftById()`; testes `tests/gifts.test.ts`). **Não há rota de envio** (`POST /social/gifts` = Phase 7, T120), nem saldo/notificação/histórico — e o catálogo **não é semeado**: `prisma/seed.ts` só semeia usuários + fallbacks de horóscopos (decisão S2-4: catálogo fixo em código, sem env de preço; "Moedas" do SPEC-007 = **Versos**).

---

## Descrição

O Sistema de Presentes do **Arkana Agora** permite que os usuários expressem apreço e reconhecimento enviando presentes virtuais animados. Os presentes podem ser enviados em publicações, leituras compartilhadas ou diretamente no perfil de outro usuário, criando uma economia interna de reconhecimento social. Cada presente possui um valor em **Versos**, a moeda virtual da plataforma, e gera uma notificação ao destinatário com uma animação de exibição.

Os presentes variam desde opções acessíveis (Estrela Cadente, 10 Versos) até itens de alto valor (Coroa Astral 200, Dragão Dourado 500), criando um sistema de expressão em camadas. O histórico de presentes enviados e recebidos fica disponível no perfil do usuário. Uma porcentagem dos Versos gastos em presentes é convertida em receita real para o destinatário (caso seja um profissional), incentivando a criação de conteúdo de qualidade.

---

## Catálogo de Presentes

> **Fonte canônica (Sprint 2 Phase 0.5 / T036)**: `src/lib/social/gifts.ts` — SPEC-007 RF-SOC-006 exato, **6 presentes**, preços fixos em Versos, `id` kebab-case (decisão de conteúdo). O id é o valor de `Gift.giftId`; "Moedas" do spec = **Versos**. A lista antiga de 9 itens (Estrela … Universo) e a coluna de **Raridade** não existem no código (o `GiftCatalogItem` tem só `id`, `name`, `cost`, `emoji`) — raridade, se retomada, é decisão de produto futura.

| Presente | Ícone | Preço (Versos) | `giftId` |
|---|---|---|---|
| Estrela Cadente | 🌠 | 10 | `estrela-cadente` |
| Rosa Mística | 🌹 | 25 | `rosa-mistica` |
| Cristal de Quartzo | 💎 | 50 | `cristal-de-quartzo` |
| Bola de Cristal | 🔮 | 100 | `bola-de-cristal` |
| Coroa Astral | 👑 | 200 | `coroa-astral` |
| Dragão Dourado | 🐉 | 500 | `dragao-dourado` |

---

## Funcionalidades

- **Envio de presentes** em publicações, leituras compartilhadas e perfis
- **Animação de exibição** ao receber presente (full-screen, 3 segundos)
- **Catálogo de presentes** fixo em código (SPEC-007, 6 itens em `src/lib/social/gifts.ts`)
- **Histórico de presentes** enviados e recebidos
- **Conversão para receita** — profissionais recebem 70% do valor em Reais
- **Moeda Versos** — pacotes de compra via Mercado Pago
- **Presentes em massa** (futuro) — enviar o mesmo presente para múltiplos usuários
- **Presentes exclusivos** (futuro) — itens sazonais e de eventos especiais

---

## Moeda Versos

| Pacote | Preço (R$) | Versos | Bônus |
|---|---|---|---|
| Iniciante | R$ 4,90 | 50 | — |
| Explorador | R$ 9,90 | 120 | +20% |
| Místico | R$ 24,90 | 350 | +40% |
| Oráculo | R$ 49,90 | 800 | +60% |
| Mago | R$ 99,90 | 1.800 | +80% |

---

## Fluxo Principal

1. O usuário visualiza uma publicação, leitura ou perfil de outro usuário
2. Toca no ícone de presente (🪙)
3. O catálogo de presentes é exibido com animações de preview
4. O usuário seleciona o presente desejado
5. O sistema verifica o saldo de Versos do usuário
6. Se saldo insuficiente, redireciona para compra de pacotes
7. O presente é debitado e uma animação é exibida para o destinatário
8. O destinatário recebe uma notificação push e in-app
9. Se o destinatário é profissional, 70% do valor é creditado em Reais
10. O presente aparece no histórico de ambos os usuários

> ⚠️ **Decisões abertas antes da T120 (Phase 7):**
> - Passos 5–7 dependem do saldo `UserProfile.versosBalance`, que hoje só tem o utilitário `src/lib/social/versos.ts` (`earnVersos()` — T037); **claim diário/milestones (T122) e `GET /versos/balance` (T121) ainda não existem**, então não há como comprar/completar saldo.
> - Passo 9 conflita com o campo real `Gift.recipientEarnsHalf` (`@default(false)` = "+50% em Versos para destinatário PROFESSIONAL", ver `docs/03-database/entities.md` §Gift): **70% em Reais vs +50% em Versos** — definição de produto pendente (o schema hoje só suporta a segunda).

---

## Versão

| Feature | Versão |
|---|---|
| Catálogo básico de presentes | V1 |
| Envio em publicações e perfis | V1 |
| Animação de exibição | V1 |
| Conversão para receita (profissionais) | V1 |
| Pacotes de compra de Versos | V1 |
| Presentes sazonais | V2 |
| Presentes em massa | V2 |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| Autenticação | Módulo interno | Usuário autenticado |
| Social | Módulo interno | Presentes em publicações |
| Profissionais | Módulo interno | Conversão para receita |
| Pagamentos | Módulo interno | Compra de Versos via Mercado Pago |
| Notificações | Módulo interno | Alerta de presente recebido |
| WebSocket | Infraestrutura | Exibição em tempo real da animação — **serviço pronto desde a Phase 2.5 (2026-10-02): `socket-service/` na 3003 e o evento `gift-received` já existe no `RealtimeEventMap` (`socket-service/src/emitters.ts`), mas ninguém ainda o emite — o wiring é T120/Phase 3** |

---

## Critérios de Aceite

- **CA-01**: O envio de um presente deve ser concluído em menos de 3 cliques e a animação deve ser exibida ao destinatário em menos de 2 segundos
- **CA-02**: O saldo de Versos deve ser atualizado em tempo real (latência máxima de 500ms entre envio e débito)
- **CA-03**: A conversão para Reais (profissionais) deve ser processada com precisão centesimal e disponível para saque em até 24 horas
- **CA-04**: O histórico de presentes deve exibir data, remetente, destinatário, tipo de presente e valor com paginação infinita
- **CA-05**: A compra de pacotes de Versos deve processar o pagamento e creditar o saldo em menos de 15 segundos