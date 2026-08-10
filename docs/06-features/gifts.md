# Sistema de Presentes — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Sistema de Presentes | **Versão**: V1

---

## Descrição

O Sistema de Presentes do **Arkana Agora** permite que os usuários expressem apreço e reconhecimento enviando presentes virtuais animados. Os presentes podem ser enviados em publicações, leituras compartilhadas ou diretamente no perfil de outro usuário, criando uma economia interna de reconhecimento social. Cada presente possui um valor em **Versos**, a moeda virtual da plataforma, e gera uma notificação ao destinatário com uma animação de exibição.

Os presentes variam desde opções acessíveis (Estrela, Lua) até itens raros e de alto valor (Fênix, Dragão Dourado), criando um sistema de expressão em camadas. O histórico de presentes enviados e recebidos fica disponível no perfil do usuário. Uma porcentagem dos Versos gastos em presentes é convertida em receita real para o destinatário (caso seja um profissional), incentivando a criação de conteúdo de qualidade.

---

## Catálogo de Presentes

| Presente | Ícone | Preço (Versos) | Raridade |
|---|---|---|---|
| Estrela | ⭐ | 10 | Comum |
| Lua | 🌙 | 20 | Comum |
| Rosa | 🌹 | 30 | Comum |
| Cristal | 💎 | 50 | Incomum |
| Borboleta | 🦋 | 50 | Incomum |
| Coroa | 👑 | 100 | Raro |
| Fênix | 🔥 | 200 | Raro |
| Dragão Dourado | 🐉 | 500 | Épico |
| Universo | 🌌 | 1.000 | Lendário |

---

## Funcionalidades

- **Envio de presentes** em publicações, leituras compartilhadas e perfis
- **Animação de exibição** ao receber presente (full-screen, 3 segundos)
- **Catálogo de presentes** organizado por raridade e preço
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
| WebSocket | Infraestrutura | Exibição em tempo real da animação |

---

## Critérios de Aceite

- **CA-01**: O envio de um presente deve ser concluído em menos de 3 cliques e a animação deve ser exibida ao destinatário em menos de 2 segundos
- **CA-02**: O saldo de Versos deve ser atualizado em tempo real (latência máxima de 500ms entre envio e débito)
- **CA-03**: A conversão para Reais (profissionais) deve ser processada com precisão centesimal e disponível para saque em até 24 horas
- **CA-04**: O histórico de presentes deve exibir data, remetente, destinatário, tipo de presente e valor com paginação infinita
- **CA-05**: A compra de pacotes de Versos deve processar o pagamento e creditar o saldo em menos de 15 segundos