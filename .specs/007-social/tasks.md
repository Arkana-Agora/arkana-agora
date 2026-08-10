# SPEC-007: Redes Sociais -- Tarefas

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## Tarefas de Implementacao

### Infraestrutura Real-Time

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 1 | Configurar mini-servico Socket.io na porta 3003 | pending | 2 | - |
| 2 | Configurar Redis como Socket.io adapter | pending | 1.5 | 1 |
| 3 | Implementar auth middleware para WebSocket (validacao JWT) | pending | 2 | 1 |
| 4 | Implementar salas (rooms) por usuario, post e feed | pending | 1.5 | 3 |
| 5 | Implementar eventos: new-post, like-updated, comment-added | pending | 2.5 | 4 |
| 6 | Implementar eventos: follow-update, gift-received, notification | pending | 2 | 4 |
| 7 | Criar hook useSocket no cliente (conexao, reconnect, rooms) | pending | 2 | 3 |

### Backend - API Routes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 8 | Criar schema Prisma: Post, PostLike, Comment, Follow, Gift, PostHashtag, Notification | pending | 2 | - |
| 9 | Implementar POST /api/v1/posts (criar post) | pending | 2.5 | 8 |
| 10 | Implementar GET /api/v1/feed (algoritmo de feed) | pending | 3 | 8 |
| 11 | Implementar POST /api/v1/posts/:id/like (alternar curtida) | pending | 1.5 | 8 |
| 12 | Implementar POST /api/v1/posts/:id/comments | pending | 2 | 8 |
| 13 | Implementar POST /api/v1/users/:id/follow | pending | 1.5 | 8 |
| 14 | Implementar POST /api/v1/users/:id/gifts | pending | 2 | 8 |
| 15 | Implementar GET /api/v1/explore/* (trending, hashtags, suggestions) | pending | 3 | 8 |
| 16 | Implementar GET /api/v1/search | pending | 2 | 8 |
| 17 | Implementar GET /api/v1/notifications + PUT /api/v1/notifications/:id/read | pending | 2 | 8 |

### Frontend - Componentes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 18 | Criar componente FeedPage com layout responsivo e infinite scroll | pending | 3 | 10, 7 |
| 19 | Criar componente PostComposer com abas, mencoes e hashtags | pending | 3.5 | 9 |
| 20 | Criar componente PostCard com imagens, acoes e preview de tiragem | pending | 4 | 11, 12 |
| 21 | Criar componente CommentSection com respostas aninhadas | pending | 3 | 12 |
| 22 | Criar componente GiftSelector com catalogo e animacao | pending | 2.5 | 14 |
| 23 | Criar componente ExplorePage com tabs e busca | pending | 3 | 15, 16 |
| 24 | Criar componente NotificationsPage com lista e marcacao de lido | pending | 2 | 17 |
| 25 | Criar pagina /post/:id (detalhe do post) | pending | 2 | 20, 21 |

### Integracao Real-Time

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 26 | Integrar new-post: ao publicar, emitir para seguidores | pending | 1.5 | 5, 9 |
| 27 | Integrar like-updated: ao curtir, emitir para room do post | pending | 1 | 5, 11 |
| 28 | Integrar comment-added: ao comentar, emitir + notificar | pending | 1.5 | 5, 12 |
| 29 | Integrar follow-update: ao seguir, emitir + notificar | pending | 1 | 6, 13 |

### Testes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 30 | Criar testes de integracao para endpoints de posts e feed | pending | 3 | 9-12 |
| 31 | Criar testes de integracao para follow, gifts, notificacoes | pending | 2 | 13-17 |
| 32 | Criar testes E2E de fluxo social: seguir -> postar -> curtir -> comentar | pending | 4 | 18-25 |
| 33 | Criar testes de WebSocket (conectividade, eventos, reconexao) | pending | 3 | 1-7 |

---

## Resumo

| Categoria | Total de Tarefas | Horas Estimadas |
|---|---|---|
| Infraestrutura Real-Time | 7 | 12.5h |
| Backend - API Routes | 10 | 21.5h |
| Frontend - Componentes | 8 | 23h |
| Integracao Real-Time | 4 | 5h |
| Testes | 4 | 12h |
| **TOTAL** | **33** | **74h** |

---

## Ordem Recomendada de Execucao

1. Tarefa 8 (schema Prisma)
2. Tarefas 1-4 (Socket.io infraestrutura)
3. Tarefa 7 (hook useSocket no cliente)
4. Tarefas 9-10 (posts e feed)
5. Tarefa 19 (PostComposer)
6. Tarefa 20 (PostCard)
7. Tarefa 18 (FeedPage)
8. Tarefas 11-12 (curtidas e comentarios)
9. Tarefa 21 (CommentSection)
10. Tarefa 25 (pagina de detalhe)
11. Tarefas 5-6 (eventos WebSocket)
12. Tarefas 26-29 (integracao real-time)
13. Tarefas 13 (follow)
14. Tarefa 14 (gifts)
15. Tarefa 22 (GiftSelector)
16. Tarefas 15-16 (explore e busca)
17. Tarefa 23 (ExplorePage)
18. Tarefa 17 (notificacoes)
19. Tarefa 24 (NotificationsPage)
20. Tarefas 30-33 (testes)
