# Definição de Entidades — arkana-agora

> Versão: 1.3 | Última atualização: 2026-09-28

---

> **Status:** **25 models implementados** — `User`, `UserProfile`, `Subscription`, `Session`, `VerificationToken` (init `20260813000605_init` + `20260902015420_add_token_version` + `20260921160000_add_username_birthplace_privacy`), `Reading`/`ReadingCard` (`20260921230000_add_reading_reading_card`), `Interpretation`/`FollowUpMessage`/`AIDailyUsage` (`20260922034000_add_ai_interpretations`), `ArcanaCalculation` (`20260923183900_add_arcana_calculations`), **Sprint 2 Phase 0 (2026-09-26)** `Follow`, `Post`, `Comment`, `PostLike`, `CommentLike`, `PostHashtag`, `Gift`, `Notification`, `ContentReport`, `HoroscopeContent`, `HoroscopeEntry`, `HoroscopeLog`, `HoroscopeNotification` (`20260926182325_sprint2_social_horoscopes`), **`FollowReward`** (`20260928205906_follow_reward_marker`, Sprint 2 review 2026-09-29) — migrations aplicadas em dev PostgreSQL (12 na chain; `20260928210717_follow_keyset_indexes` e `20260929142921_secondary_indexes_review` só mexem em índices). As demais entidades do ERD alvo (`TarotDeck`, `Card`, `Spread`, `DailyCard`, marketplace `Product`/`Order`/`Payment`) permanecem planejadas e não existem no schema. **As seções §7/§9/§10/§11/§15/§16 abaixo são o formato alvo do ERD** — os models homônimos já existem no schema com campos diferentes (as notas de status de cada seção apontam o desvio); os models novos sem seção (`PostLike`, `CommentLike`, `PostHashtag`, `ContentReport`, `HoroscopeContent`, `HoroscopeLog`, `HoroscopeNotification`, `FollowReward`) estão definidos só em `prisma/schema.prisma`. `Session`/`VerificationToken` **não têm seção aqui** — são cópia de `.specs/001-auth/design.md` §4 (rotas custom `/api/v1/auth/*`, ADR-009). Consulte `prisma/schema.prisma` para o que está realmente implementado.

---

## 1. User

Entidade principal de autenticação e identidade do usuário.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK**, default `uuidv4()` | Identificador único |
| `email` | `String` | **UQ**, **IDX**, `@email` | E-mail do usuário |
| `passwordHash` | `String?` | nullable | Hash bcrypt (nulo para OAuth) |
| `name` | `String` | NOT NULL | Nome completo (privado) |
| `displayName` | `String` | NOT NULL | Nome público no perfil |
| `avatar` | `String?` | nullable | URL do avatar (Cloudflare R2) |
| `role` | `UserRole` | NOT NULL, default `USER` | Papel no sistema |
| `plan` | `UserPlan` | NOT NULL, default `FREE` | Plano de assinatura |
| `subscriptionTier` | `UserPlan` | NOT NULL, default `FREE` | Tier usado pelo limite de posts (`checkPostLimit`, T027) — **campo distinto de `plan`** (Sprint 2, T014/SC17). ⚠️ **Contrato de sincronização (review data I7 / simpc N13)**: hoje **nada escreve** `subscriptionTier` (todo consumidor existente lê `plan`); a primeira integração de billing **deve atualizar as duas colunas no mesmo `$transaction`** (ou o plano adotar uma única fonte) — senão um PLUS vira FREE no cap de posts (ou vice-versa) de forma invisível |
| `isBanned` | `Boolean` | NOT NULL, default `false` | Banimento de moderação (Sprint 2, T014) |
| `bannedAt` | `DateTime?` | nullable | Data/hora do banimento |
| `banReason` | `String?` | nullable | Motivo do banimento |
| `maxFollowing` | `Int` | NOT NULL, default `5000` | Limite de "seguindo" por usuário — checado **dentro do `$transaction`** da rota de follow (`src/app/api/v1/social/follow/[userId]/route.ts`, T043/review 2026-09-29) com count de `Follow` do viewer → 409 `MAX_FOLLOWING_REACHED` com `details.max` (**não** é o rate limit `checkFollowLimit`, que é 20/min; a checagem de `whoCanFollow` vem antes — **só no branch de follow novo**: unfollow nunca passa pelo gate, revisão 2026-09-29/I1) |
| `birthDate` | `DateTime?` | nullable | Data de nascimento |
| `astrologicalSign` | `String?` | nullable | Signo do zodíaco ocidental |
| `mayanKin` | `String?` | nullable | Kin maia (Tzolkin). Cálculo = **correlação GMT 584283** (`GMT_CORRELATION_JDN` em `src/lib/horoscopes/maya.ts`; `calculateKinMaya` delega — decisão Phase 0 Sprint 2, AC-11/RF-HORO-004). Valores gravados antes do Sprint 2 estão stale → backfill `prisma/backfill-mayankin.ts` |
| `personalArcana` | `Int?` | nullable | Número do arcano pessoal (range **1–22**, `0` não é emitido pelo cálculo). Escrito por **três** caminhos: (1) `GET /api/v1/arcana/calculate` — best-effort, só quando `null`; **self-heal CAS** no read: se cache `observed` ≠ `recomputed`, executa `updateMany({ where: { id, personalArcana: observed }, data: { personalArcana: recomputed } })` para curar stale cache; (2) `PATCH /api/v1/users/me/profile` — recalculado quando `birthDate` chega com data válida; **null-out explícito** se `name` vazio (`personalArcana: null` no update); (3) `birthDate: ""` — único caminho de reset completo (zera `birthDate`, `astrologicalSign`, `mayanKin`, `personalArcana`). Enrichment OAuth (Google) invalida `personalArcana` **apenas quando** nome muda **E** `birthDate` presente. |
| `provider` | `AuthProvider` | NOT NULL | Provedor de autenticação |
| `providerId` | `String` | NOT NULL, **UQ comp.** with provider | ID do provedor OAuth (convenção: EMAIL → email normalizado lowercase, GOOGLE/FACEBOOK → OAuth subject ID) |
| `emailVerified` | `DateTime?` | nullable | Data de verificação do e-mail |
| `tokenVersion` | `Int` | NOT NULL, default `0` | Revogação imediata de role/plan/suspensão/reset de senha/logout-all (SPEC-001 §7.4; fonte-da-verdade — Redis é somente cache espelhado) |
| `isActive` | `Boolean` | NOT NULL, default `true` | Conta ativa |
| `deletedAt` | `DateTime?` | nullable | Timestamp para soft delete LGPD (30-day restoration window). Após 30 dias, o job T16 (`src/jobs/hard-delete-accounts.ts`) anonimiza a conta (inclui bump de `tokenVersion` e purga de `VerificationToken` por `identifier` — o e-mail original, sem FK para `User`) — `deletedAt` é **preservado** (não limpo) para auditoria |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data de criação |
| `updatedAt` | `DateTime` | NOT NULL, `@updatedAt` | Data de atualização |

> ⚠️ **Invariantes de contadores (review data I4)**: `Post.likeCount`/`Post.commentCount` e `Comment.likeCount` **não têm caminho de escrita ainda**. Quando as rotas de like/comment chegarem: (a) mutar `{ increment: 1 }`/`{ decrement: 1 }` **no mesmo `$transaction`** do insert/delete; (b) como `ON DELETE CASCADE` (hard-delete/anonimização) não roda código de app, os cascateamentos deixam drift **permanente** — ✅ **(b) implementado (Sprint 2 T147)**: reconciliação periódica no cron `src/jobs/counter-reconcile.ts` (rota `GET /api/cron/counter-reconcile`, diário 04:00 UTC em `vercel.json`) que recomputa via `UPDATE ... SET likeCount = (SELECT count(*) ...) WHERE divergente` (idempotente; `total` de rows corrigidas no summary). Triggers de DB continuam alternativa válida se a volume exigir (único mecanismo que sobrevive a cascade/`deleteMany` sem app code). Exigência original documentada aqui como I4.

**Enums**:
- `UserRole`: `USER`, `PROFESSIONAL`, `ADMIN`
- `UserPlan`: `FREE`, `PLUS`
- `AuthProvider`: `EMAIL`, `GOOGLE`, `FACEBOOK`

---

## 2. UserProfile

Perfil público extendido do usuário (1:1 com User). Criado automaticamente no registro.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `userId` | `UUID` | **FK** → User.id, **UQ** | Usuário dono do perfil |
| `bio` | `String?` | nullable, max 500 chars | Biografia do perfil |
| `location` | `String?` | nullable | Localização (cidade/estado) |
| `website` | `String?` | nullable, `@url` | Site pessoal |
| `socialLinks` | `Json?` | nullable | Links sociais (Instagram, TikTok, YouTube) |
| `skills` | `String[]` | default `[]` | Habilidades ("Tarot", "Runas", "Astrologia") |
| `specialties` | `String[]` | default `[]` | Especialidades ("Amor", "Carreira", "Espiritual") |
| `rating` | `Decimal` | default `0.0`, min 0, max 5 | Avaliação média |
| `reviewCount` | `Int` | default `0`, min 0 | Total de avaliações recebidas |
| `pricePerReading` | `Decimal?` | nullable, min 0 | Preço por leitura (profissionais) |
| `available` | `Boolean` | default `true` | Disponível para leituras pagas |
| `languages` | `String[]` | default `["pt-BR"]` | Idiomas de atendimento |
| `versosBalance` | `Int` | NOT NULL, default `0` | Saldo da moeda **Versos** — fonte única, mutado só dentro de `$transaction` (Sprint 2, S2-17); invariante `>= 0` garantida no banco pelo CHECK `UserProfile_versosBalance_nonneg` (migration `20260927222620`). ⚠️ **Padrão obrigatório de débito (review data I3)**: como não existe `spendVersos`/decrement hoje, qualquer futuro débito (gifts T120, claim T122) **deve** ser escrita condicional única — `updateMany({ where: { userId, versosBalance: { gte: cost } }, data: { versosBalance: { decrement: cost } } })` dentro do `$transaction`, com `count === 0` → aborta (saldo insuficiente); **nunca** read-then-write (corrida gera saldo negativo estourando o CHECK) |
| `versosStreak` | `Int` | NOT NULL, default `0` | Streak do claim diário (T122) |
| `lastClaimAt` | `DateTime?` | nullable | Última claim diária — base da idempotência do claim (T122) |

**Exemplo de `socialLinks`**:
```json
{
  "instagram": "@tarotista_julia",
  "tiktok": "@julia.tarot",
  "youtube": "@juliacartas"
}
```

---

## 3. Reading

Registro de uma leitura de cartas realizada pelo usuário.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `userId` | `UUID` | **FK** → User.id, **IDX** | Usuário que realizou a leitura |
| `spreadType` | `SpreadType` | NOT NULL | Tipo de spread (disposição) |
| `cards` | `Json` | NOT NULL | Cartas tiradas com posições |
| `interpretation` | `String?` | nullable, max 5000 chars | Interpretação gerada pela IA |
| `mood` | `ReadingMood` | NOT NULL | Tema/energia da leitura |
| `isPublic` | `Boolean` | default `false` | Visível no perfil/feed |
| `aiModel` | `String?` | nullable | Modelo de IA utilizado |
| `tokensUsed` | `Int?` | nullable | Tokens consumidos na geração |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data da leitura |

**Enums**:
- `SpreadType`: `SINGLE`, `THREE_CARD`, `CELTIC_CROSS`, `LOVE`, `YES_NO`, `CUSTOM`
- `ReadingMood`: `GENERAL`, `LOVE`, `CAREER`, `HEALTH`, `SPIRITUAL`

**Exemplo de `cards`**:
```json
[
  {
    "cardId": "card_01",
    "position": 0,
    "positionName": "Passado",
    "isReversed": false,
    "name": "O Mago",
    "number": 1,
    "suit": "MAJOR_ARCANA"
  },
  {
    "cardId": "card_14",
    "position": 1,
    "positionName": "Presente",
    "isReversed": true,
    "name": "A Temperança",
    "number": 14,
    "suit": "MAJOR_ARCANA"
  },
  {
    "cardId": "card_21",
    "position": 2,
    "positionName": "Futuro",
    "isReversed": false,
    "name": "O Mundo",
    "number": 21,
    "suit": "MAJOR_ARCANA"
  }
]
```

---

## 4. Card

Carta individual de um baralho.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `deckId` | `UUID` | **FK** → TarotDeck.id, **IDX** | Baralho ao qual pertence |
| `name` | `String` | NOT NULL | Nome da carta ("O Mago", "Ás de Copas") |
| `number` | `Int?` | nullable | Número da carta (I a XXI, ou 1-14 para naipes) |
| `suit` | `CardSuit` | NOT NULL | Naipe ou Arcano Maior |
| `meaning_upright` | `String` | NOT NULL, max 1000 chars | Significado na posição normal |
| `meaning_reversed` | `String` | NOT NULL, max 1000 chars | Significado na posição invertida |
| `keywords` | `Json` | NOT NULL | Palavras-chave da carta |
| `imageUrl` | `String` | NOT NULL, `@url` | URL da imagem da carta |

**Enum**:
- `CardSuit`: `MAJOR_ARCANA`, `WANDS`, `CUPS`, `SWORDS`, `PENTACLES`

**Exemplo de `keywords`**:
```json
["manifestação", "criatividade", "habilidade", "concentração", "ação"]
```

---

## 5. TarotDeck

Baralho completo disponível na plataforma.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `name` | `String` | NOT NULL, **UQ** | Nome do baralho |
| `type` | `DeckType` | NOT NULL | Tipo/sistema do baralho |
| `description` | `String` | NOT NULL, max 500 chars | Descrição do baralho |
| `cardCount` | `Int` | NOT NULL, min 1 | Quantidade de cartas |
| `isActive` | `Boolean` | default `true` | Disponível para uso |

**Enum**:
- `DeckType`: `RIDER_WAITE`, `THOTH`, `LENORMAND`, `CUSTOM_MYSTIC`

**Dados de seed**:
- Rider-Waite-Smith (78 cartas): 22 Arcanos Maiores + 56 Arcanos Menores
- Baralho Cigano Lenormand (36 cartas)
- Thoth (78 cartas)

---

## 6. ArcanaCalculation

Cálculo do arcano pessoal do usuário baseado em data de nascimento e nome.

> **Status**: ✅ **implementada** — tabela `arcana_calculations` (migration `20260923183900_add_arcana_calculations`).
> `GET /api/v1/arcana/calculate` grava **duas** coisas de forma **não-bloqueante** (falha de escrita
> só gera `logger.warn`, nunca quebra a resposta 200):
>
> 1. **`User.personalArcana`** — só quando ainda estava `null` (fix 2026-09-25); se já existe cache,
>    a rota **não sobrescreve** (o número persistido é a fonte de verdade da resposta). **Self-heal CAS**:
>    se o valor cacheado (`observed`) difere do recalculado (`recomputed`), executa
>    `updateMany({ where: { id, personalArcana: observed }, data: { personalArcana: recomputed } })`
>    para curar cache stale no read — o CAS garante atomicidade.
> 2. **Histórico** em `arcana_calculations` — gravado a cada chamada.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `userId` | `UUID` | **FK** → User.id, **IDX** | Usuário |
| `birthDate` | `DateTime` | NOT NULL | Data de nascimento usada |
| `fullName` | `String` | NOT NULL | Nome completo usado na redução |
| `reductionDate` | `String` | NOT NULL | Passo a passo da redução numerológica da data |
| `reductionName` | `String` | NOT NULL | Passo a passo da redução do nome |
| `arcanaNumber` | `Int` | NOT NULL, **min 1, max 22** | Número do arcano. O cálculo emite **1–22** (`reduceToArcana` normaliza `0 → 22`); `0` não é emitido; `22` = "O Louco" (número mestre) |
| `arcanaName` | `String` | NOT NULL | Nome do arcano |
| `description` | `String` | NOT NULL, max 2000 chars | Descrição interpretativa do arcano |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data do cálculo |

---

## 7. HoroscopeEntry

Entrada de horóscopo para o usuário.

> **Status (Sprint 2, Phase 0):** ✅ **implementada** (migration `20260926182325_sprint2_social_horoscopes`) — **shape diferente do alvo**: `id`, `userId`, `type String` (`'western'` \| `'chinese'` \| `'maya'`), `signId String`, `element String?`, `period String` (`'daily'` \| `'weekly'` \| `'monthly'`), `createdAt` + `@@index([userId, createdAt])` (RF-HORO-007). **Não existem** `zodiacSign`, `chineseAnimal`, `mayanKin`, `content` nem `sourceDate`. A tabela abaixo é o **formato alvo** (ainda plano); escrita/leitura acontecem nas fases 5/6 do plano Sprint 2.
>
> ⚠️ **Gap de design nível spec (review data N3)**: `HoroscopeEntry`/`HoroscopeLog` **não têm coluna de data civil** — só `createdAt` (UTC), enquanto todo o domínio usa data civil BRT (Q25). "Já buscou *hoje*?" derivado de `createdAt` erra entre 00:00–03:00 BRT. `.specs/006-horoscopes/design.md` §5 define assim, portanto é **gap do spec, não desvio do schema** — submeter ao design (adicionar `date String` + `@@unique([userId, type, period, date])` com as tabelas vazias é grátis) **sem alterar spec/ADR unilateralmente**.
>
> ⚠️ **`HoroscopeContent` — contrato de escrita (review data N4)**: todo writer de `horoscope_contents` **deve** rodar `validateHoroscopeContent()` (`src/lib/horoscopes/validation.ts` — faixas RF-HORO-001 + shape zod) antes do upsert; os CHECKs de DB (`type`, `period`, `hour` — migrations `20260927222620`/`20260928004004`) são a última linha de defesa, **não** substituem a validação. Fallbacks do seed ficam fora da faixa por decisão (documentado em `docs/03-database/migrations.md`).

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `userId` | `UUID` | **FK** → User.id, **IDX** | Usuário |
| `type` | `HoroscopeType` | NOT NULL | Tipo do horóscopo |
| `zodiacSign` | `String?` | nullable | Signo do zodíaco ocidental |
| `chineseAnimal` | `String?` | nullable | Animal do zodíaco chinês |
| `mayanKin` | `String?` | nullable | Kin do calendário maia |
| `content` | `Json` | NOT NULL | Conteúdo do horóscopo estruturado |
| `sourceDate` | `DateTime` | NOT NULL | Data a que o horóscopo se refere |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data de geração |

**Enum**:
- `HoroscopeType`: `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`

**Exemplo de `content`**:
```json
{
  "general": "Um dia de transformações positivas...",
  "love": "No amor, a comunicação será fundamental...",
  "career": "Profissionalmente, novas oportunidades surgem...",
  "health": "Cuide da saúde mental com meditação...",
  "lucky_number": 7,
  "lucky_color": "Azul escuro"
}
```

---

## 8. Spread

Template de disposição de cartas (spread).

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `name` | `String` | NOT NULL | Nome do spread ("Tire 3 Cartas") |
| `cardCount` | `Int` | NOT NULL, min 1, max 22 | Número de cartas |
| `positions` | `Json` | NOT NULL | Definição das posições |
| `description` | `String` | NOT NULL, max 500 chars | Descrição do spread |
| `isPremium` | `Boolean` | default `false` | Requer plano PLUS |
| `category` | `SpreadCategory` | NOT NULL | Categoria do spread |

**Enum**:
- `SpreadCategory`: `GENERAL`, `LOVE`, `CAREER`, `SPIRITUAL`, `CUSTOM`

**Exemplo de `positions`** (Three Card):
```json
[
  { "index": 0, "name": "Passado", "description": "Influências do passado" },
  { "index": 1, "name": "Presente", "description": "Situação atual" },
  { "index": 2, "name": "Futuro", "description": "Tendências futuras" }
]
```

**Exemplo de `positions`** (Celtic Cross):
```json
[
  { "index": 0, "name": "Presente", "description": "A situação atual" },
  { "index": 1, "name": "Desafio", "description": "O obstáculo ou desafio" },
  { "index": 2, "name": "Fundamento", "description": "A base da questão" },
  { "index": 3, "name": "Passado Recente", "description": "O que está passando" },
  { "index": 4, "name": "Melhor Caminho", "description": "A meta ou crown" },
  { "index": 5, "name": "Futuro Próximo", "description": "O que está por vir" },
  { "index": 6, "name": "Consciência", "description": "Sua perspectiva" },
  { "index": 7, "name": "Influência Externa", "description": "Como outros veem" },
  { "index": 8, "name": "Esperanças e Medos", "description": "Seus desejos" },
  { "index": 9, "name": "Resultado Final", "description": "A conclusão" }
]
```

---

## 9. Follow

Relação de seguir entre usuários (N:M via tabela juntura).

> **Status (Sprint 2, Phase 0; revisado 2026-09-29):** ✅ **implementada** (`follows`) — campos conforme o alvo, com `String`/`cuid()` no lugar de `UUID` e **`@@index([followingId, createdAt, id])` + `@@index([followerId, createdAt, id])`** (keyset das listas T044/T045 — a migration `20260928210717_follow_keyset_indexes` **substituiu** os índices de coluna única `@@index([followerId])`/`@@index([followingId])` que constavam aqui) além do `@@unique([followerId, followingId])`. A regra `followerId ≠ followingId` **não tem constraint no banco** (só o unique): a validação é da aplicação — **implementada no Sprint 2 Phase 1 (T043)** em `src/app/api/v1/social/follow/[userId]/route.ts` (409 `CANNOT_FOLLOW_SELF`, validado antes do toggle). Phase 0 tinha entregado só o model. **Companheira**: `FollowReward` (`follow_rewards`, migration `20260928205906_follow_reward_marker`) — marker imutável `@@unique([followerId, followingId])` que faz os +5 Versos serem pagos **uma única vez por par** (o unfollow **não** apaga a linha; ver `relationships.md` §4.1).

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `followerId` | `UUID` | **FK** → User.id, **IDX** | Quem segue |
| `followingId` | `UUID` | **FK** → User.id, **IDX** | Quem é seguido |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data do seguimento |

**Restrição Única**: `@@unique([followerId, followingId])` — impede seguir duas vezes.

**Restrição de Negócio**: `followerId` ≠ `followingId` (não pode seguir a si mesmo) — validado na camada de aplicação.

---

## 10. Post

Postagem do feed social, opcionalmente vinculada a uma leitura.

> **Status (Sprint 2, Phase 0):** ✅ **implementada** (`posts`) — **shape divergente do alvo abaixo**: `id`, `authorId`, `type String` (`'text'` \| `'image'` \| `'reading'`), `content Text`, `imageUrls String[] @default([])`, `readingId String?` (**sem FK** — snapshot da tiragem, SPEC-007 §5), `audience String @default("public")` (`'public'` \| `'followers'`, S2-15), `isPinned`, `likeCount`, `commentCount`, `commentsDisabled`, `isHidden` (moderação T129), `createdAt`, `updatedAt` + `@@index([authorId, createdAt])` e `@@index([createdAt])`. Não existem `images Json?` nem `isPublic`; contadores são `likeCount`/`commentCount` (não `likesCount`/`commentsCount`). Domínio reforçado **no banco** pela migration `20260927222620_sprint2_review_fixes`: `posts_type_check` (`type IN ('text','image','reading')`) e `posts_audience_check` (`audience IN ('public','followers')`) — o Prisma não valida porque os campos são `String`, e as rotas `POST /api/v1/social/posts` e `GET /api/v1/social/posts/[id]` **existem desde a Sprint 2 Phase 2 (2026-10-01)** (`docs/04-api/social.md`).

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `authorId` | `UUID` | **FK** → User.id, **IDX** | Autor da postagem |
| `readingId` | `UUID?` | **FK** → Reading.id, nullable, **IDX** | Leitura compartilhada (opcional) |
| `content` | `String` | NOT NULL, min 1, max 2000 chars | Texto da postagem |
| `images` | `Json?` | nullable | URLs das imagens anexadas |
| `likesCount` | `Int` | NOT NULL, default `0`, min 0 | Contador de curtidas (denormalizado) |
| `commentsCount` | `Int` | NOT NULL, default `0`, min 0 | Contador de comentários (denormalizado) |
| `isPublic` | `Boolean` | default `true` | Visível para todos |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data de criação |
| `updatedAt` | `DateTime` | NOT NULL, `@updatedAt` | Data de atualização |

**Exemplo de `images`**:
```json
["https://assets.arkanaagora.com.br/posts/img_abc123.webp"]
```

---

## 11. Comment

Comentário em uma postagem.

> **Status (Sprint 2, Phase 0; índices revistos 2026-09-29):** ✅ **implementada** (`comments`) — `id`, `postId`, `authorId`, `content Text`, `parentCommentId String?` (**auto-relação** `CommentReplies`, `onDelete: Cascade` — respostas encadeadas), `likeCount Int @default(0)`, `createdAt` + `@@index([postId, createdAt])` **e `@@index([authorId])`** (migration `20260929142921_secondary_indexes_review`). **Não existem** `updatedAt` nem FK para `Post` com `SET NULL`: `postId` e `authorId` são `Cascade`.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `postId` | `UUID` | **FK** → Post.id, **IDX**, `onDelete CASCADE` | Postagem comentada |
| `authorId` | `UUID` | **FK** → User.id, **IDX** | Autor do comentário |
| `content` | `String` | NOT NULL, min 1, max 1000 chars | Texto do comentário |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data de criação |
| `updatedAt` | `DateTime` | NOT NULL, `@updatedAt` | Data de edição |

---

## 12. Product

Produto do marketplace (leitura paga, curso, produto físico esotérico).

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `sellerId` | `UUID` | **FK** → User.id, **IDX** | Vendedor (profissional) |
| `name` | `String` | NOT NULL, **IDX**, **FTS** | Nome do produto |
| `description` | `String` | NOT NULL, **FTS** | Descrição detalhada |
| `price` | `Decimal` | NOT NULL, min 0 | Preço em BRL |
| `category` | `String` | NOT NULL, **IDX** | Categoria do produto |
| `images` | `Json` | NOT NULL, default `[]` | URLs das imagens do produto |
| `isActive` | `Boolean` | default `true` | Produto ativo/visível |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data de criação |

**Categorias**: `"leitura_online"`, `"leitura_presencial"`, `"curso"`, `"cartas"`, `"cristais"`, `"incensos"`, `"outros"`

---

## 13. Order

Pedido de compra no marketplace.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `buyerId` | `UUID` | **FK** → User.id, **IDX** | Comprador |
| `productId` | `UUID` | **FK** → Product.id, **IDX** | Produto comprado |
| `amount` | `Decimal` | NOT NULL, min 0 | Valor total em BRL |
| `status` | `OrderStatus` | NOT NULL, default `PENDING` | Status do pedido |
| `paymentId` | `UUID?` | **FK** → Payment.id, nullable | Pagamento associado |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data do pedido |
| `updatedAt` | `DateTime` | NOT NULL, `@updatedAt` | Data de atualização |

**Enum**:
- `OrderStatus`: `PENDING`, `PAID`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `DISPUTED`

---

## 14. Payment

Registro de pagamento processado via Mercado Pago.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `userId` | `UUID` | **FK** → User.id, **IDX** | Usuário que pagou |
| `orderId` | `UUID?` | **FK** → Order.id, nullable, **IDX** | Pedido associado (opcional) |
| `amount` | `Decimal` | NOT NULL, min 0 | Valor em BRL |
| `method` | `PaymentMethod` | NOT NULL | Método de pagamento |
| `status` | `PaymentStatus` | NOT NULL, default `PENDING` | Status do pagamento |
| `externalId` | `String?` | nullable, **UQ** | ID externo no Mercado Pago |
| `metadata` | `Json?` | nullable | Dados adicionais do gateway |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data do pagamento |

**Enums**:
- `PaymentMethod`: `MERCADO_PAGO`, `CREDIT_CARD`, `PIX`
- `PaymentStatus`: `PENDING`, `APPROVED`, `REJECTED`, `REFUNDED`, `CANCELLED`

**Exemplo de `metadata`**:
```json
{
  "mp_payment_id": 123456789,
  "mp_preference_id": "pref_abc123",
  "mp_payment_type": "credit_card",
  "mp_installments": 3,
  "mp_card_last_four": "4242",
  "mp_payer_email": "comprador@email.com"
}
```

---

## 15. Gift

Presente virtual enviado entre usuários.

> **Status (Sprint 2, Phase 0):** ✅ **implementado** (`gifts`) — **shape divergente do alvo abaixo**: `id`, `fromUserId`, `toUserId`, `giftId String` (id no **catálogo fixo** SPEC-007 — catálogo implementado em `src/lib/social/gifts.ts`, T036), `coinCost Int` (**custo em Versos**; "Moedas" do S2-4 = Versos), `recipientEarnsHalf Boolean @default(false)` (+50% p/ destinatário PROFESSIONAL, T120), `createdAt` + `@@index([toUserId, createdAt])`. Não existem `senderId`/`receiverId`/`giftType`/`message`.
>
> ⚠️ **Decisão de cascade/ledger (review data N6)**: gifts recebidos são **preservados** no hard-delete do doador (ledger do doador) enquanto o restante cascateia — decisão mantida **enquanto Versos não virar equivalente monetário**; quando virar, a matriz de cascade muda para `SetNull` + snapshots imutáveis do ledger (nada de cascade que apaga histórico financeiro). Nenhuma ação agora; revisitar na integração de billing.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `senderId` | `UUID` | **FK** → User.id, **IDX** | Quem envia o presente |
| `receiverId` | `UUID` | **FK** → User.id, **IDX** | Quem recebe o presente |
| `giftType` | `String` | NOT NULL | Tipo de presente |
| `message` | `String?` | nullable, max 280 chars | Mensagem personalizada |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data do envio |

**Tipos de presente**: `"tarot_card"`, `"crystal"`, `"candle"`, `"star"`, `"heart"`, `"custom"`

---

## 16. Notification

Notificação para o usuário.

> **Status (Sprint 2, Phase 0):** ✅ **implementada** (`notifications`) — `id`, `userId`, `type String` (`'follow'` \| `'like'` \| `'comment'` \| `'gift'` \| `'mention'` \| `'horoscope'`), `message String` (**não** `title`/`body`), `data Json?`, `isRead Boolean @default(false)`, `createdAt` + `@@index([userId, isRead, createdAt])`. Não existem `title`, `body` nem o enum `NotificationType` do alvo — a lista de categorias abaixo é o formato planejado. As 6 categorias estão agora **DB-enforced** por `notifications_type_check` (`type IN ('follow','like','comment','gift','mention','horoscope')`, migration `20260927222620_sprint2_review_fixes`); escrever uma 7ª categoria viola a constraint (não há rota de escrita de notificações ainda).

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `userId` | `UUID` | **FK** → User.id, **IDX** | Destinatário |
| `type` | `NotificationType` | NOT NULL | Tipo da notificação |
| `title` | `String` | NOT NULL, max 100 chars | Título da notificação |
| `body` | `String` | NOT NULL, max 300 chars | Corpo da notificação |
| `data` | `Json?` | nullable | Dados estruturados adicionais |
| `isRead` | `Boolean` | NOT NULL, default `false`, **IDX parcial** | Se foi lida |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data de criação |

**Enum**:
- `NotificationType`: `LIKE`, `COMMENT`, `FOLLOW`, `GIFT`, `PAYMENT`, `READING`, `SYSTEM`

**Exemplo de `data`**:
```json
{
  "postId": "post_abc123",
  "likerName": "Maria",
  "likerAvatar": "https://assets.arkanaagora.com.br/avatars/maria.webp"
}
```

---

## 17. Subscription

Assinatura do plano PLUS do usuário.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `userId` | `UUID` | **FK** → User.id, **UQ** | Usuário assinante |
| `plan` | `String` | NOT NULL, default `PLUS` | Nome do plano |
| `status` | `SubscriptionStatus` | NOT NULL | Status da assinatura |
| `startDate` | `DateTime` | NOT NULL | Início da assinatura |
| `endDate` | `DateTime?` | nullable | Fim da assinatura |
| `trialEnd` | `DateTime?` | nullable | Fim do período de trial |
| `externalId` | `String?` | nullable | ID no gateway de recorrência |

**Enum**:
- `SubscriptionStatus`: `ACTIVE`, `CANCELLED`, `EXPIRED`, `TRIAL`

---

## 18. DailyCard

Carta do dia gerada pelo sistema para todos os usuários.

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| `id` | `UUID` | **PK** | Identificador único |
| `date` | `DateTime` | **UQ**, **IDX** | Data (apenas uma por dia) |
| `cardId` | `UUID` | **FK** → Card.id | Carta selecionada |
| `interpretation` | `String` | NOT NULL, max 2000 chars | Interpretação do dia |
| `createdAt` | `DateTime` | NOT NULL, default `now()` | Data de geração |

**Geração**: Job diário via BullMQ às 00:00 UTC-3 (meia-noite de Brasília). Seleciona aleatoriamente uma carta do baralho ativo e gera interpretação via IA.

---

## Resumo de Tipos

| Tipo Prisma | Tipo PostgreSQL | Uso no arkana-agora |
|-------------|-----------------|----------------------|
| `String` | `TEXT` | Nomes, textos, URLs |
| `Int` | `INTEGER` | Contadores, números de carta |
| `Decimal` | `DECIMAL(10,2)` | Preços, avaliações |
| `Boolean` | `BOOLEAN` | Flags (ativo, público) |
| `DateTime` | `TIMESTAMPTZ` | Datas com timezone |
| `Json` | `JSONB` | Dados estruturados flexíveis |
| `UUID` | `UUID` | Identificadores únicos |
| `String[]` | `TEXT[]` | Arrays de strings (skills, languages) |

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*
