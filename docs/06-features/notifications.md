# Notificações — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Notificações | **Versão**: V1

---

## Descrição

O módulo de Notificações do **Arkana Agora** gere toda a comunicação assíncrona da plataforma, operando em duas frentes: **notificações push** (web push e mobile) e o **centro de notificações in-app**. O sistema suporta oito categorias de notificação — curtida, comentário, novo seguidor, presente recebido, pagamento, leitura compartilhada, atualização de sistema e lembrete diário — cada uma com controle granular de preferências pelo usuário.

As notificações push utilizam o padrão Web Push API para navegadores e FCM (Firebase Cloud Messaging) para dispositivos móveis, com suporte a notificações silenciosas (badge count apenas) e notificações interativas (com ações de resposta rápida). O centro de notificações in-app armazena o histórico completo e organiza por categorias com indicadores visuais de não lidas. O sistema utiliza filas (message queue) para garantir entrega ordenada e retrial automático em caso de falha.

---

## Funcionalidades

- **Push notifications** via Web Push API (navegadores) e FCM (mobile)
- **Centro de notificações in-app** com histórico completo
- **Oito categorias de notificação** com controle individual
- **Controle granular de preferências** (por categoria: push, in-app, e-mail, silencioso)
- **Badge count** no ícone do app e no menu de navegação
- **Notificações interativas** com ações rápidas (curtir de volta, responder comentário)
- **Mark as read** individual e em massa
- **Fila de entrega** com retry automático (3 tentativas, backoff exponencial)
- **Limpeza automática** — notificações lidas são removidas após 30 dias

---

## Categorias de Notificação

| Categoria | Descrição | Push Padrão | In-App Padrão |
|---|---|---|---|
| `like` | Alguém curtiu sua publicação ou leitura | ✅ | ✅ |
| `comment` | Alguém comentou em sua publicação | ✅ | ✅ |
| `follow` | Alguém começou a te seguir | ✅ | ✅ |
| `gift` | Você recebeu um presente virtual | ✅ | ✅ |
| `payment` | Pagamento confirmado, recibo disponível | ✅ | ✅ |
| `reading_share` | Alguém compartilhou uma leitura com você | ❌ | ✅ |
| `system` | Atualizações da plataforma, manutenção | ❌ | ✅ |
| `reminder` | Lembrete de Tarot Diário | ✅ | ❌ |

---

## Fluxo Principal

1. Um evento gerador é disparado (ex.: alguém curte uma publicação)
2. O serviço de notificações recebe o evento via fila de mensagens
3. O sistema consulta as preferências do destinatário para a categoria
4. Se push habilitado, envia notificação push (FCM/Web Push)
5. A notificação é persistida no banco de dados (in-app)
6. O badge count é atualizado via WebSocket para o cliente conectado
7. O usuário visualiza a notificação no centro de notificações in-app
8. O usuário pode tocar na notificação para navegar até o conteúdo relacionado
9. O usuário pode marcar como lida individualmente ou limpar todas
10. Notificações lidas são removidas automaticamente após 30 dias

---

## Versão

| Feature | Versão |
|---|---|
| Centro de notificações in-app | V1 |
| Push notifications (web + mobile) | V1 |
| Preferências granulares | V1 |
| Badge count em tempo real | V1 |
| Notificações interativas com ações rápidas | V2 |
| Digest diário por e-mail | V2 |
| Notificações inteligentes (horário de pico) | V2 |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| Autenticação | Módulo interno | Identificação do usuário |
| Social | Módulo interno | Eventos de curtida, comentário, seguidor |
| Presentes | Módulo interno | Evento de presente recebido |
| Pagamentos | Módulo interno | Confirmação de transações |
| Tarot Diário | Módulo interno | Lembrete diário |
| FCM (Firebase) | API externa | Push notifications mobile |
| Web Push API | API do navegador | Push notifications web |
| Message Queue (Bull/Redis) | Infraestrutura | Fila de entrega com retry |
| WebSocket | Infraestrutura | Badge count em tempo real |

---

## Critérios de Aceite

- **CA-01**: Uma notificação push deve ser entregue em menos de 5 segundos após o evento gerador
- **CA-02**: O centro de notificações deve carregar as 20 mais recentes em menos de 1 segundo com paginação infinita
- **CA-03**: A alteração de preferências deve ser aplicada em menos de 1 segundo e refletida nas próximas notificações
- **CA-04**: O badge count deve ser atualizado em tempo real (latência máxima de 2 segundos) para todos os dispositivos do usuário
- **CA-05**: O sistema deve suportar o envio de 10.000 notificações por segundo sem degradação de performance
