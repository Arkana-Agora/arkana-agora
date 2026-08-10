# Sprint 2 — Social + Conteúdo

> **Projeto**: Arkana Agora  
> **Identificador**: `arkana-agora`  
> **Duração**: 4 semanas  
> **Equipe**: 2-3 desenvolvedores  
> **Status**: Planejamento  
> **Dependência**: Sprint 1 completo

---

## Objetivo

Adicionar features sociais (feed, follow, interações) e expandir o conteúdo esotérico com horóscopos (Ocidental, Chinês e Maia), gifts virtuais e exploração de perfis.

---

## User Stories

| # | User Story | Critério de Aceite | Prioridade |
|---|-----------|-------------------|------------|
| US-020 | Como usuário, quero seguir outros usuários para ver suas tiragens | Botão seguir/deseguir, lista de seguidos/seguidores | Alta |
| US-021 | Como usuário, quero compartilhar minha tiragem no feed | Post criado com imagens das cartas e interpretação | Alta |
| US-022 | Como usuário, quero ver um feed com tiragens de quem sigo | Timeline cronológica com posts de seguidos | Alta |
| US-023 | Como usuário, quero curtir e comentar publicações | Like toggle + formulário de comentário | Média |
| US-024 | Como usuário, quero consultar horóscopos (ocidental, chinês, maia) | Páginas dedicadas com leitura diária para cada sistema | Alta |
| US-025 | Como usuário, quero calcular meu Kin Maya | Algoritmo Tzolkin correto, resultado com Selo + Tom | Alta |
| US-026 | Como usuário, quero enviar presentes virtuais para outros usuários | Catálogo de gifts, confirmação de envio, notificação | Média |
| US-027 | Como usuário, quero navegar no marketplace | Listagem de produtos com filtros e busca | Média |

---

## Tasks Detalhadas

### Sistema Social
- [ ] 1. Modelo de dados: `Follow` (follower_id, following_id)
- [ ] 2. API: follow/unfollow com validação (não seguir a si mesmo)
- [ ] 3. Lista de seguidores e seguidos no perfil
- [ ] 4. Contador de seguidores em destaque no perfil

### Feed
- [ ] 5. Modelo de dados: `Post` (author_id, reading_id, content, visibility)
- [ ] 6. Feed timeline: query por following → fallback para suggested
- [ ] 7. Criação de posts com compartilhamento de readings
- [ ] 8. Imagem compartilhável gerada (Open Graph cards)
- [ ] 9. Infinito scroll no feed (cursor-based pagination)

### Interações
- [ ] 10. Sistema de likes (toggle, contador)
- [ ] 11. Sistema de comentários (CRUD, nested replies limitados)
- [ ] 12. Notificações in-app: likes, follows, gifts, comentários
- [ ] 13. Badge de notificações não lidas

### Horóscopo Ocidental
- [ ] 14. Tabela de signos com datas precisas (incluindo cuspides)
- [ ] 15. Conteúdo diário para os 12 signos (template + variação)
- [ ] 16. Página de horóscopo com signo do usuário em destaque
- [ ] 17. Compatibilidade entre signos (amizade, amor, trabalho)

### Horóscopo Chinês
- [ ] 18. Algoritmo de cálculo do animal chinês (data de nascimento)
- [ ] 19. Sistema dos 5 elementos (Madeira, Fogo, Terra, Metal, Água)
- [ ] 20. Combinação Animal × Elemento (60 ciclos sexagenários)
- [ ] 21. Conteúdo descritivo para cada combinação

### Horóscopo Maia
- [ ] 22. Algoritmo de Kin Maya (calendário Tzolkin: 20 Selos × 13 Tons = 260 dias)
- [ ] 23. Integração dos 20 Selos Solares (nome, significado, tom, cor)
- [ ] 24. Integração dos 13 Tons Galácticos (nome, poder, ação, essência)
- [ ] 25. Cálculo da Onda Encantada (9 posições do destino)
- [ ] 26. Página dedicada com visual rico do Kin Maya

### Gifts e Economia Virtual
- [ ] 27. Catálogo de 6 tipos de gifts: 🌟 Estrela, 🦋 Borboleta, 🔮 Cristal, 🌙 Lua, 🌹 Rosa, ✨ Brilho
- [ ] 28. Moeda virtual "Versos" (sistema de saldo)
- [ ] 29. Ganhos de Versos: login diário, interações, milestones
- [ ] 30. Gastos de Versos: enviar gifts, desbloquear conteúdo premium

### Explore e Busca
- [ ] 31. Página Explore: trending readings, perfis populares, profissionais
- [ ] 32. Busca de usuários por nome ou username
- [ ] 33. Moderação básica: report de conteúdo, filtro de palavras

### Banco de Dados
- [ ] 34. Migrations: `Follow`, `Post`, `Comment`, `Like`, `Gift`, `HoroscopeEntry`
- [ ] 35. Índices de performance para queries do feed
- [ ] 36. Seed data: horóscopos, selos maias, gifts

### Real-time
- [ ] 37. WebSocket service para atualizações do feed em tempo real
- [ ] 38. Reconnection logic e fallback para polling

---

## Critérios de Aceite do Sprint

- [x] Feed funcional com posts de seguidos e suggested
- [x] Sistema de follow/unfollow operacional
- [x] Likes e comentários funcionando
- [x] Horóscopo Ocidental calculando e exibindo corretamente
- [x] Horóscopo Chinês com animal e elemento corretos
- [x] Kin Maya calculado via algoritmo Tzolkin
- [x] Gifts enviáveis e recebíveis com notificação
- [x] Notificações in-app para interações
- [x] Página Explore com busca de usuários

---

## Dependências

| Dependência | Tipo | Status |
|------------|------|--------|
| Sprint 1 completo | Bloqueante | Necessário |
| Conteúdo dos horóscopos (textos) | Conteúdo | Preparar antes do início |
| Dados dos 20 Selos + 13 Tons Maia | Conteúdo | Preparar antes do início |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Algoritmo Tzolkin incorreto | Média | Alto | Validar com calculadoras de referência, testar bordas |
| Performance do feed com muitos posts | Média | Médio | Cursor pagination, cache Redis, query optimization |
| Moderação de conteúdo inadequado | Alta | Médio | Filtro de palavras, sistema de report, review manual |
| WebSocket instability | Baixa | Médio | Fallback para polling, auto-reconnect |

---

## Estimativa

| Módulo | Horas | Dias Úteis |
|--------|-------|-------------|
| Sistema Social (follow + perfil) | 32h | 4d |
| Feed + Posts | 48h | 6d |
| Likes + Comentários | 32h | 4d |
| Horóscopo Ocidental | 24h | 3d |
| Horóscopo Chinês | 32h | 4d |
| Horóscopo Maia (Tzolkin) | 40h | 5d |
| Gifts + Versos | 32h | 4d |
| Explore + Busca | 24h | 3d |
| Notificações | 16h | 2d |
| DB + Seeds | 16h | 2d |
| WebSocket | 16h | 2d |
| **Total** | **~312h** | **39d (4 semanas)** |

---

## Entregáveis

- Feed social funcional com timeline e infinite scroll
- Sistema completo de follow/interações
- Três sistemas de horóscopo (Ocidental, Chinês, Maia)
- Kin Maya com Onda Encantada
- Sistema de gifts e moeda virtual "Versos"
- Notificações in-app
- Página Explore com busca
