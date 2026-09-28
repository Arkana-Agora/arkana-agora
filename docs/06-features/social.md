# Rede Social — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Rede Social | **Versão**: V1
>
> **Status (2026-09-26)**: **parcialmente implementado.** Desde o Sprint 2 Phase 0 existem no schema os models `Follow`, `Post`, `Comment`, `PostLike`, `CommentLike`, `PostHashtag` e `ContentReport` (migração `20260926182325_sprint2_social_horoscopes`). Desde o **Phase 0.5** existem as **utilidades compartilhadas**, ainda sem rota/UI: `src/lib/social/feed-algorithm.ts` (T026), `src/lib/social/limits.ts` (T027), `src/lib/social/mentions.ts`, `src/lib/social/gifts.ts` (T036), `src/lib/social/versos.ts` (T037), `src/lib/csrf.ts` + `src/lib/middleware/{rate-limit,csrf}.ts` (T040/T041), `src/lib/feed-cache.ts` + cron `src/jobs/feed-cache-refresh.ts` (T042), `src/lib/og-image.ts` (T029), `src/hooks/use-social.ts`, `src/components/route-error.tsx`. **Não há rota em `src/app/api/v1/social/` nem UI de feed** (rotas = Phase 1/2 do plano). Contrato de endpoints: `docs/04-api/social.md`.

---

## Descrição

O módulo de Rede Social do **Arkana Agora** transforma a plataforma em uma comunidade viva de entusiastas de esoterismo, Tarot e autoconhecimento. O feed de notícias é ordenado por **quatro níveis** (S2-5/RF-SOC-002, implementado em `src/lib/social/feed-algorithm.ts`): posts fixados, engajamento das últimas 2 horas, recência e interação prévia do usuário — 10 posts por página, com fallback para o conteúdo de **Explorar** quando o usuário ainda não segue ninguém. A descoberta de novos criadores e profissionais (conteúdos em alta e sugestões) fica por conta da página Explorar. Esse modelo garante relevância e descoberta simultaneamente.

O sistema de publicações suporta texto livre, compartilhamento de leituras salvas (com visualização inline do baralho) e upload de imagens. A interação é composta por likes, comentários encadeados e envio de presentes virtuais. A página Explorar oferece curadoria de conteúdos populares, profissionais em destaque e temas esotéricos em tendência. Mecanismos de moderação incluem denúncias de conteúdo e bloqueio de usuários, com revisão pela equipe administrativa.

---

## Funcionalidades

- **Seguir/deixar de seguir** usuários
- **Feed timeline** com ordenação em 4 níveis (fixado → engajamento 2h → recência → interação prévia; fallback explore em 0 following)
- **Criação de publicações** com texto, compartilhamento de leitura e imagens (até 4 por post)
- **Sistema de likes** com contagem e lista de curtidores
- **Comentários encadeados** (até 3 níveis de profundidade)
- **Página Explorar** com seções: Leituras em Alta, Top Profissionais, Temas em Tendência
- **Denunciar conteúdo** (categorização: spam, assédio, conteúdo inadequado, outro)
- **Bloquear usuário** (oculta mútuo, sem notificação)
- **Compartilhamento de leitura** inline nas publicações

---

## Algoritmo do Feed

> **Implementado (Sprint 2 Phase 0.5, T026)** em `src/lib/social/feed-algorithm.ts`. O rascunho antigo "3 camadas com pesos" (peso × recency × engagement, janela de 24h) foi **substituído** pela ordenação em 4 níveis do S2-5; sugestões/trending não entram no ranking do feed — ficam com Explorar (Phase 2).

```
Candidatos (S2-15): isHidden = false
  E (audience = 'public'
     OU audience = 'followers' com authorId em followingIds)
  + perfil privado (UserProfile.privacy.profileVisibility = 'PRIVATE')
    só aparece para quem segue o autor
  + 0 following → só posts públicos (fallback explore)

Ordenação (4 níveis, por página de 10):
1. Post fixado (isPinned)      — no máximo 1 por página
2. Engajamento das últimas 2h  — likes + comments × 2
3. Recência (createdAt desc)
4. Desempate                  — viewer já interagiu (PostLike/Comment) e id desc

Cursor: base64url de { createdAt, id } = menor (createdAt, id) já lido —
aproximação sobre o ranking: paginação estável, sem repetir nem pular posts.
Cache: src/lib/feed-cache.ts (Redis, TTL 5 min) para perfis com
> 1000 seguindo, materializado pelo cron src/jobs/feed-cache-refresh.ts (*/5 * * * *).
```

---

## Fluxo Principal

1. O usuário acessa o feed na tela inicial da aba "Comunidade"
2. O sistema carrega as publicações seguindo a ordenação em 4 níveis (fallback para Explorar quando o usuário ainda não segue ninguém)
3. O usuário rola a tela para carregar mais conteúdo (scroll infinito)
4. O usuário pode curtir, comentar ou compartilhar qualquer publicação
5. O usuário pode criar uma nova publicação tocando no botão "Publicar"
6. Na criação, o usuário digita o texto, opcionalmente anexa imagens ou compartilha uma leitura salva
7. A publicação é exibida no feed dos seguidores e, se com alto engajamento, no Explorar
8. O usuário pode denunciar ou bloquear outros usuários a qualquer momento
9. O usuário pode acessar a aba "Explorar" para descobrir novos conteúdos e perfis

---

## Versão

| Feature | Versão |
|---|---|
| Feed timeline básico | V1 |
| Seguir/deixar de seguir | V1 |
| Publicações (texto + leitura + imagens) | V1 |
| Likes e comentários | V1 |
| Página Explorar | V1 |
| Denúncia e bloqueio | V1 |
| Stories/destaques temporários | V2 |
| Grupos e comunidades | V2 |
| Mensagens diretas | V2 |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| Autenticação | Módulo interno | Usuário deve estar autenticado |
| Perfil | Módulo interno | Dados do perfil para feed |
| Tarot / Lenormand | Módulo interno | Compartilhamento de leituras |
| Presentes | Módulo interno | Envio de presentes em posts |
| Armazenamento de arquivos | Infraestrutura | Upload de imagens |
| Moderação (Admin) | Módulo interno | Revisão de denúncias |

---

## Critérios de Aceite

- **CA-01**: O feed deve carregar a primeira tela de conteúdo em menos de 2 segundos, com imagens lazy-loaded
- **CA-02**: O algoritmo deve priorizar publicações de seguidos em pelo menos 60% da primeira tela de novos usuários
- **CA-03**: Uma publicação com imagem deve ser criada e exibida no feed em menos de 5 segundos
- **CA-04**: O sistema de denúncias deve encaminhar o conteúdo para a fila de moderação em menos de 1 segundo e enviar confirmação ao denunciante
- **CA-05**: O bloqueio de um usuário deve ocultar suas publicações imediatamente em todas as visualizações do bloqueador, sem notificação ao bloqueado