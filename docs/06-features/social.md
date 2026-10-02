# Rede Social — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Rede Social | **Versão**: V1
>
> **Status (2026-10-01)**: **parcialmente implementado — follow (Phase 1) + posts/feed/explore (Phase 2) entregues.**
>
> **Correções pós-revisão (2026-10-01, W4–W7):**
> - **Feed cache**: hit serve a página **completa** (cursor = pivot do algoritmo com `include`; cortar no `limit` reencodava pelo último do ranking → posts duplicados/pulados) e `POST /social/posts` chama `refreshFeedCache(authorId)` após criar.
> - **Headers**: erros 404/500 de todas as rotas sociais saem com `Cache-Control: private, no-store` + `Vary: Authorization`; og-image público sai **sem** `Vary` (resposta idêntica com/sem token), gated e erros com `private, no-store`.
> - **Presign de posts**: checagem de `Content-Length` removida (era morta — media o JSON do request, não a imagem; 5MB é guard do PUT assinado; pendência S2-12 = HEAD pós-PUT); ext canônica unificada em `EXT_BY_TYPE` (`src/lib/validators/social.ts`).
> - **Avatar**: `enforceCsrf` em `presign` + `confirm` + `DELETE /users/me/avatar` (**6 rotas CSRF no total** — o DELETE entrou na review 2026-10-01, W4–W8; antes contado como 5) e `enforceSocialLimit({ limit: "upload" })` (20/dia) em `presign` + `confirm`; `confirm` checa o tamanho via `headObjectSize()` **antes** de baixar o objeto (review C3).
> - **Composer**: presign em lote (uma requisição para as ≤4 imagens).
> - **Busca/explore**: cursor keyset estável `(createdAt, id)`, `take = 10× SEARCH_LIMIT` para hashtags (paginação sem repor), filtros de privacidade fail-closed (perfil `private` excluído de resultados).
> - **ShareModal**: lê `useSession()` (testes mockam `next-auth/react` com `useSession`).
> - **Validação**: `feedPostSchema` com `datetime` + enums; single source `getR2PublicUrl()` (`src/lib/r2-public-url.ts`).
> - Gates: `tsc --noEmit` + Prettier + ESLint + **148 arquivos de teste verdes** (1 skipped).
>
> **Detalhamento histórico (Phase 0–2)**: Desde o Sprint 2 Phase 0 existem no schema os models `Follow`, `Post`, `Comment`, `PostLike`, `CommentLike`, `PostHashtag` e `ContentReport` (migração `20260926182325_sprint2_social_horoscopes`). Desde o **Phase 0.5** existem as **utilidades compartilhadas**: `src/lib/social/feed-algorithm.ts` (T026), `src/lib/social/limits.ts` (T027), `src/lib/social/mentions.ts`, `src/lib/social/gifts.ts` (T036), `src/lib/social/versos.ts` (T037), `src/lib/csrf.ts` + `src/lib/middleware/{rate-limit,csrf}.ts` (T040/T041), `src/lib/feed-cache.ts` + cron `src/jobs/feed-cache-refresh.ts` (T042), `src/lib/og-image.ts` (T029), `src/hooks/use-social.ts`, `src/components/route-error.tsx`. **Phase 1 (2026-09-28, T043–T050)**: rotas de follow `src/app/api/v1/social/follow/[userId]/route.ts` (toggle POST), `src/app/api/v1/users/[username]/{followers,following}/route.ts`, libs `src/lib/social/{privacy,follow-lists}.ts` (`canFollow` T049, keyset S2-18), UI `src/components/social/{follow-button,followers-modal}.tsx` (**componentes prontos e testados, ainda sem wiring em nenhuma page** — `FollowButton` usa `useMutation` inline; **não existe hook `useToggleFollow`**), hook `useFollowList` (`src/hooks/use-social.ts`, infinite query sobre o envelope S2-18) — testes `tests/integration/social-follow.test.ts` (43, incl. 3 de corrida), `tests/social-privacy.test.ts` (8), `tests/find-visible-profile.test.ts` (11 — `findVisibleProfile`/SC38), `tests/components/follow-button.test.tsx` (8) + `tests/components/followers-modal.test.tsx` (13). **Revisão 2026-09-29**: `POST /social/follow/:userId` passou a exigir CSRF (`enforceCsrf`), a rejeitar alvo banido/soft-deleted com 404, a checar `maxFollowing` dentro da transação (`details.max`) e a pagar **+5 Versos só na primeira vez por par** (marker `FollowReward`, `earnVersos` dentro do tx; re-follow não recompensa; `earnVersos === null` **aborta a tx** — marker nunca fica sem pagamento). **Re-review 2026-09-29 (focada)**: **unfollow nunca passa por `whoCanFollow`** (a direção é decidida antes do gate — revogação sempre possível); contadores do toggle/profile/corridas passaram a usar o helper único **`readFollowCounts()`** (`src/lib/social/follow-lists.ts`, exclui `isBanned`/`deletedAt` — SC39/Q2); handlers `P2002`/`P2025` **re-querem `follow.findUnique`** (fonte de verdade) em vez de assumir qual constraint falhou (falha na re-query → 500 JSON com `rate.headers`); **SC38/Q1 fechados** — listas `followers`/`following` respondem **404 para não-dono** com `statsVisibility: "private"` e o **dono vê os contadores** no profile; `findVisibleProfile` loga `logger.warn` quando o privacy JSON falha no `safeParse`. **Phase 2 (2026-10-01, T051–T065)**: rotas `src/app/api/v1/social/{posts,feed,explore,search}/…` (`POST /social/posts` com moderação → 403 `CONTENT_BLOCKED` e limite diário 10 FREE/50 PLUS; `GET /social/feed` com envelope S2-18 + cache; `GET /social/explore/{trending,hashtags,suggestions}`; `GET /social/search`; `GET /social/posts/:id` + `og-image` com predicado compartilhado `src/lib/social/post-visibility.ts`; `POST /social/posts/images/presign`), validadores `src/lib/validators/social.ts`, libs `src/lib/social/{explore,search,post-visibility}.ts`; UI `src/app/(app)/feed/page.tsx` (infinite scroll + pill "N novos posts"), `src/components/social/{post-card,post-composer,share-modal}.tsx` e hooks `src/hooks/use-feed.ts` (`useFeed`/`useCreatePost`/`useTrending`/`useExploreSuggestions`/`useSearch`) — testes `tests/integration/social-feed.test.ts` (52), `tests/integration/social-explore.test.ts` (20) + suítes de componentes/hooks. **Ainda não existem**: página `/explorar` (T126 — só `explorar/error.tsx`), página `/post/[id]` (T131 — só `error.tsx`; o `ShareModal` já gera o link `/post/{id}`), likes/comentários (T076–T078), gifts (T120) e notifications (T082–T084). Contrato de endpoints: `docs/04-api/social.md`.

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

> **Implementado (Sprint 2 Phase 0.5, T026)** em `src/lib/social/feed-algorithm.ts`. O rascunho antigo "3 camadas com pesos" (peso × recency × engagement, janela de 24h) foi **substituído** pela ordenação em 4 níveis do S2-5; sugestões/trending não entram no ranking do feed — ficam com Explorar (**endpoints entregues na Phase 2**: T053–T056 em `src/app/api/v1/social/explore/*` e `/social/search`; a **página** `/explorar` T126 continua **planejada**).

```
Candidatos (S2-15): isHidden = false
  E (audience = 'public'
     OU audience = 'followers' com authorId em followingIds)
  + perfil privado (UserProfile.privacy.profileVisibility = 'private' —
    contrato MINUSCULO do privacySchema; fix S2-15 na Phase 2, o check
    antigo 'PRIVATE' nunca casava e vazava posts de perfil privado)
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
> 1000 seguindo, materializado pelo cron src/jobs/feed-cache-refresh.ts (0 0 * * *, diário desde SC34).
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