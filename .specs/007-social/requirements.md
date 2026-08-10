# SPEC-007: Redes Sociais

**Plataforma**: Arkana Agora
**Versao**: MVP
**Status**: Pendente
**Data**: 2025-01-01

---

## 1. Visao Geral

Este documento define os requisitos do sistema de redes sociais do Arkana Agora. A funcionalidade social permite que usuarios se conectem, compartilhem suas experiencias com tarot e construam comunidade em torno da plataforma.

---

## 2. Requisitos Funcionais

### RF-SOC-001: Sistema de Seguir/Deixar de Seguir
O sistema deve permitir que usuarios sigam e deixem de seguir outros usuarios:
- Botao "Seguir" no perfil de outros usuarios
- Apos seguir, o botao muda para "Seguindo" com opcao de desfazer (hover: "Deixar de seguir")
- Contagem de seguidores e seguindo atualizada em tempo real via Socket.io
- Notificacao ao usuario seguido: "[nome] comecou a te seguir"
- Usuario pode restringir quem pode segui-lo nas configuracoes de privacidade (SPEC-002)
- Limite maximo de seguindo: 5.000 (para evitar abuse de bots)
- Verificacao de privacidade: se o perfil e privado, so seguidores veem o conteudo

### RF-SOC-002: Feed de Atualizacoes
O sistema deve exibir um feed personalizado com atualizacoes de usuarios seguidos:
- **Fontes de conteudo no feed**:
  - Tiragens compartilhadas publicamente
  - Posts de texto (ate 500 caracteres)
  - Posts com imagem (ate 4 imagens, cada uma max 5MB)
  - Tiragens com interpretacao IA
- **Algoritmo de ordenacao**:
  1. Posts patrocinados/pinados (administracao) -- apenas 1 a cada 10 posts
  2. Posts com alta engajamento recente (likes + comentarios nas ultimas 2h)
  3. Posts de usuarios seguidos, ordenados por data decrescente
  4. Posts de usuarios seguidos com interacao anterior (curtidas, comentarios)
- **Paginacao**: infinite scroll com 10 posts por pagina
- **Atualizacao em tempo real**: novos posts de usuarios seguidos aparecem com animacao de slide-in via Socket.io
- Feed inicial para usuarios sem seguidos: posts publicos com mais engajamento nas ultimas 24h ("Explore")

### RF-SOC-003: Criacao de Posts
O usuario deve poder criar posts nos seguintes formatos:
- **Post de texto**: ate 500 caracteres, suporte a mencoes (@username) e hashtags (#assunto)
- **Post com imagens**: ate 4 imagens (JPEG/PNG/WebP, max 5MB cada), + texto opcional de ate 300 caracteres
- **Compartilhamento de tiragem**: selecionar uma tiragem salva e opcionalmente adicionar texto de ate 200 caracteres
- Ao criar um post com tiragem, gerar automaticamente imagem de preview
- Mentions: ao digitar @, abrir dropdown de busca de usuarios (debounce 300ms)
- Hashtags: ao digitar #, abrir dropdown de hashtags populares (top 10)
- Posts sao publicos por padrao; opcao de "Apenas seguidores"

### RF-SOC-004: Sistema de Curtidas
O sistema deve permitir curtir e descurtir posts:
- Um clique no icone de curtir: alterna entre curtido/nao curtido
- Animacao de "coracao" ao curtir (scale up + fade, Framer Motion)
- Contagem de curtidas atualizada em tempo real (Socket.io)
- Usuario NAO pode curtir o proprio post
- Curtidas anonimas: outros usuarios NAO veem quem curtiu

### RF-SOC-005: Sistema de Comentarios
O sistema deve permitir comentarios em posts:
- Texto de ate 300 caracteres
- Respostas a comentarios (1 nivel de profundidade -- sem threads infinitos)
- Ordenacao: mais recentes primeiro
- Paginacao: carregar mais 10 comentarios por vez
- Curtir comentarios (contagem apenas, sem lista de quem curtiu)
- Notificacao ao autor do post: "[nome] comentou no seu post"
- Notificacao ao autor do comentario respondido: "[nome] respondeu ao seu comentario"
- Opcao de excluir proprio comentario
- Comentarios podem ser desativados pelo autor do post nas configuracoes de privacidade

### RF-SOC-006: Sistema de Presentes (Gifts)
O sistema deve permitir enviar presentes virtuais entre usuarios:
- Presentes comprados com "Moedas" (moeda virtual do Arkana Agora)
- Catalogo de presentes com icone, nome e preco em Moedas:
  - Estrela Cadente: 10 Moedas
  - Rosa Mystica: 25 Moedas
  - Cristal de Quartzo: 50 Moedas
  - Bola de Cristal: 100 Moedas
  - Coroa Astral: 200 Moedas
  - Dragao Dourado: 500 Moedas
- O presente e exibido no perfil do destinatario com animacao especial
- O destinatario recebe 50% do valor em Moedas (apenas para perfis profissionais)
- Historico de presentes recebidos/enviados
- Limite: 10 presentes por dia por remetente

### RF-SOC-007: Pagina de Explorar (Explore)
O sistema deve ter uma pagina de exploracao para descobrir conteudo:
- **Trending**: posts com mais engajamento nas ultimas 24h
- **Hashtags em alta**: top 10 hashtags mais utilizadas na ultima semana
- **Usuarios sugeridos**: usuarios que seguem usuarios que voce segue, ordenados por seguidores
- **Tiragens em destaque**: tiragens compartilhadas com mais curtidas
- Busca por texto livre (busca em posts, usuarios e hashtags)

---

## 3. Requisitos Nao Funcionais

### RNF-SOC-001: Latencia de Atualizacoes em Tempo Real
Todas as atualizacoes em tempo real (novos posts, curtidas, comentarios, seguidores) devem ser entregues em menos de 2 segundos via Socket.io. O mini-servico Socket.io roda na porta 3003 com Redis como adapter.

### RNF-SOC-002: Escalabilidade do Feed
A query do feed deve ser executada em menos de 300ms para usuarios com ate 1.000 usuarios seguidos. Para perfis com mais seguidores, utilizar pre-computacao (materialized view ou cache).

### RNF-SOC-003: Upload de Imagens
O upload de ate 4 imagens simultaneas deve completar em menos de 8 segundos (P95) em conexoes 4G.

---

## 4. Dependencias

| Dependencia | Versao | Proposito |
|---|---|---|
| Socket.io | >=4.x | Comunicacao em tempo real |
| Redis | >=7.x | Socket.io adapter para multi-instancia |
| Cloudflare R2 | - | Armazenamento de imagens |
| Zustand | >=4.x | Estado de feed e notificacoes |
| TanStack Query | >=5.x | Cache de feed e comentarios |
| sharp | >=0.33.x | Resize de imagens |

---

## 5. Criterios de Aceite

| ID | Criterio | Metodo de Validacao |
|---|---|---|
| CA-SOC-001 | Usuario A segue Usuario B; a contagem de seguidores de B incrementa em tempo real ( Socket.io) | Teste E2E com 2 navegadores |
| CA-SOC-002 | Usuario cria post de texto; o post aparece no feed de seus seguidores em menos de 2 segundos | Teste E2E com Socket.io |
| CA-SOC-003 | Usuario curte um post; a animacao de coracao e exibida e a contagem atualizada em tempo real | Teste E2E |
| CA-SOC-004 | Usuario comenta em um post; o autor recebe notificacao em tempo real | Teste E2E com 2 navegadores |
| CA-SOC-005 | Pagina Explore exibe trending, hashtags em alta e usuarios sugeridos com dados reais | Teste de integracao |