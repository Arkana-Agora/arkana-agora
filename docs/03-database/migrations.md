# Estratégia de Migrações — arkana-agora

> Versão: 1.3 | Última atualização: 2026-09-28

---

## 1. Visão Geral

O arkana-agora utiliza **Prisma Migrate** para gerenciamento versionado do esquema do banco de dados. Todas as alterações de schema são rastreadas como arquivos de migration no repositório.

```
prisma/
├── schema.prisma          # Schema fonte de verdade (datasource postgresql)
└── migrations/
    ├── 20260813000605_init/
    │   └── migration.sql   # User, UserProfile, Subscription, Session, VerificationToken — APLICADA (Sprint 0 / F1)
    ├── 20260902015420_add_token_version/
    │   └── migration.sql   # tokenVersion no User — APLICADA (Módulo 1 Auth, T5)
    ├── 20260921160000_add_username_birthplace_privacy/
    │   └── migration.sql   # username/birthPlace/privacy no UserProfile — APLICADA (Sprint 1 / Profile)
    ├── 20260921230000_add_reading_reading_card/
    │   └── migration.sql   # Reading + ReadingCard — APLICADA (Sprint 1 / Tarot)
    ├── 20260922034000_add_ai_interpretations/
    │   └── migration.sql   # Interpretation, FollowUpMessage, AIDailyUsage — APLICADA (Sprint 1 / AI)
    ├── 20260923183900_add_arcana_calculations/
    │   └── migration.sql   # ArcanaCalculation (arcana_calculations) + drift de índices — APLICADA (Sprint 1 / task 23)
    ├── 20260926182325_sprint2_social_horoscopes/
    │   └── migration.sql   # 13 models sociais/horóscopos + campos User/UserProfile — APLICADA (Sprint 2 / Phase 0)
    ├── 20260927222620_sprint2_review_fixes/
    │   └── migration.sql   # Índice gifts(fromUserId,createdAt) + unique NULLS NOT DISTINCT + 7 CHECKs de domínio — APLICADA (Sprint 2 / review Step 5, CRIT-2/I5)
    ├── 20260928004004_horoscope_contents_domain_checks/
    │   └── migration.sql   # CHECKs type/period de horoscope_contents — APLICADA (Sprint 2 / review Step 5, I6)
    └── migration_lock.toml  # provider = postgresql
```

---

## 2. Convenção de Nomenclatura

### Formato

```
YYYYMMDDHHMMSS_descriptive_name
```

### Exemplos

| Migration | Nome | Descrição |
|-----------|------|-----------|
| `20260813000605` | `init` | Criação inicial (User, UserProfile, Subscription, Session, VerificationToken) — **aplicada (Sprint 0 / F1)** |
| `20260902015420` | `add_token_version` | Add `User.tokenVersion` (Int, default 0) p/ revogação imediata de JWT — **aplicada (Módulo 1 Auth, T5)** |
| `20260926182325` | `sprint2_social_horoscopes` | 13 models sociais/horóscopos + campos novos em `User`/`UserProfile` — **aplicada (Sprint 2 / Phase 0)** |
| `20260927222620` | `sprint2_review_fixes` | Índice `gifts(fromUserId, createdAt)`, recriação da unique de `horoscope_contents` com `NULLS NOT DISTINCT` (dedupe prévio) e **7 CHECKs** (posts/notifications/content_reports/versosBalance/hour) — **aplicada (Sprint 2 / review Step 5)** |
| `20260928004004` | `horoscope_contents_domain_checks` | CHECKs `type IN ('western','chinese','maya')` e `period IN ('daily','weekly','monthly')` em `horoscope_contents` — **aplicada (Sprint 2 / review Step 5, I6)** |
| `20250711010000` | `add_reading_tables` | Tabelas de leitura, cartas e baralhos |
| `20250712000000` | `add_social_tables` | Tabelas de feed, follows, comentários |
| `20250712010000` | `add_marketplace_tables` | Tabelas de produtos, pedidos e pagamentos |
| `20250713000000` | `add_notification_table` | Tabela de notificações |
| `20250713010000` | `add_subscription_table` | Tabela de assinaturas |
| `20250713020000` | `add_daily_card_table` | Tabela de carta do dia |

---

## 3. Fluxo por Ambiente

### 3.1 Desenvolvimento (Local)

```bash
# Prisma Postgres (default local, 2026-09-23) — prisma@^7 pin; CLI lê DIRECT_URL de prisma.config.ts
.\node_modules\.bin\prisma migrate dev --name descriptive_name

# Fallback offline: Docker Postgres 16 (sem DIRECT_URL em .env)
docker compose up -d postgres
.\node_modules\.bin\prisma migrate dev --name descriptive_name

# Aplicar migrations já existentes (sem criar nova — usado pelo compose/CI)
.\node_modules\.bin\prisma migrate deploy

# Resetar banco de desenvolvimento (CUIDADO — apaga dados)
.\node_modules\.bin\prisma migrate reset
```

**Racional**: dev usa **PostgreSQL** — Prisma Postgres (Vercel Marketplace) como default local, Docker Postgres 16 como fallback offline — mesma engine da produção/Neon, então o dev usa **migrations versionadas** (`migrate dev`) como única forma de sincronizar o schema — o SQL gerado em dev é portável para produção. `db push` **não** é usado (não gera migration files e deixaria dev fora de sync com prod). O serviço `migrate` do `docker-compose.yml` aplica migrations pendentes com `bunx prisma migrate deploy` (one-shot). **CLI pinado em `prisma@^7`** — `prisma@8` RC não tem `generate`/`migrate` (ver `docs/solutions/ci-cd/prisma-v8-cli-regression.md`).

### 3.2 Staging

```bash
# Aplicar migrações pendentes (sem interação)
.\node_modules\.bin\prisma migrate deploy

# Verificar status das migrações
.\node_modules\.bin\prisma migrate status
```

**Banco**: Neon PostgreSQL (branch de staging). Migrações aplicadas automaticamente no deploy de preview.

### 3.3 Produção

```bash
# Aplicar migrações (com backup prévio!)
.\node_modules\.bin\prisma migrate deploy
```

**Banco**: Neon PostgreSQL (produção). Migrações aplicadas no pipeline CI/CD como step antes do deploy.

---

## 4. Checklist de Migration de Produção

Antes de aplicar qualquer migration em produção, seguir obrigatoriamente:

- [ ] **Backup realizado**: Point-in-time recovery do Neon confirmado
- [ ] **Testado em staging**: Migration aplicada e validada no ambiente de staging
- [ ] **Sem downtime**: Migration não bloqueia tabelas por mais de 5 segundos
- [ ] **Rollback planejado**: SQL de rollback escrito e testado
- [ ] **Revisão de código**: Migration SQL revisada por pelo menos 1 outro desenvolvedor
- [ ] **Dados seeded**: Seed data verificado (se aplicável)
- [ ] **Monitoramento ativo**: Logs e alertas configurados para o período pós-migration
- [ ] **Janela de deploy**: Preferencialmente em horário de baixo tráfego (02:00-05:00 BRT)

---

## 5. Migrations — status (aplicadas e planejadas)

### Sprint 0 — Autenticação (MVP) — ✅ APLICADA (Sprint 0 / F1, 2026-08-13)

**Migration**: `20260813000605_init` — **aplicada em dev** (Docker Postgres 16). Cobre **5 models**: `User`, `UserProfile`, `Subscription`, `Session`, `VerificationToken` (Session/VerificationToken = cópia de `.specs/001-auth/design.md` §4). SQL real versionado: `prisma/migrations/20260813000605_init/migration.sql` (`migration_lock.toml` = `postgresql`). Gerada com `bunx prisma migrate dev --name init` após a troca do datasource para `postgresql`.

### Módulo 1 — Autenticação (T5) — ✅ APLICADA (2026-09-01)

**Migration**: `20260902015420_add_token_version` — aplicada em dev (Postgres local). Adiciona `User.tokenVersion` (`INTEGER NOT NULL DEFAULT 0`) para revogação imediata de JWT (role/plan/suspensão, reset de senha, logout-all — SPEC-001 §7.4). Gerada com atomic chain da skill `prisma` (`bunx prisma migrate dev --name addTokenVersion`); drift-check: SQL contém somente o `ALTER TABLE` da coluna; **defesa em profundidade (C1):** após o `ALTER`, rodado `UPDATE "User" SET "tokenVersion" = 1` (invalida JWTs pré-recurso em DB populado; no dev, tabela vazia → no-op). SQL real versionado: `prisma/migrations/20260902015420_add_token_version/migration.sql`.

> ⚠️ **Ilustrativo, não copiar.** O SQL abaixo é o **rascunho de planejamento** (pré-migration) e cobre apenas `User`/`UserProfile`; `Subscription`/`Session`/`VerificationToken` seguiram o mesmo processo. O SQL real gerado pelo Prisma difere (tipos nativos, enums, `TEXT[]` etc.) — **o arquivo versionado é a fonte de verdade**. Regra da disciplina (§4.4): **nunca criar migration files manualmente** — gere com o Prisma CLI e revise o SQL gerado.

```sql
-- Criar tabela User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "birthDate" TIMESTAMP(3),
    "astrologicalSign" TEXT,
    "mayanKin" TEXT,
    "personalArcana" INTEGER,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_provider_providerId_key" ON "User"("provider", "providerId");

-- Criar tabela UserProfile
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "location" TEXT,
    "website" TEXT,
    "socialLinks" JSONB,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "pricePerReading" DECIMAL(10,2),
    "available" BOOLEAN NOT NULL DEFAULT true,
    "languages" TEXT[] DEFAULT ARRAY['pt-BR']::TEXT[],
    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Sprint 1 — Profile / Leitura / AI / Arcano — ✅ APLICADAS (2026-09-23 em dev)

**Migrations**: `20260921160000_add_username_birthplace_privacy` (UserProfile: username, birthPlace, privacy — T007), `20260921230000_add_reading_reading_card` (Reading + ReadingCard — T037), `20260922034000_add_ai_interpretations` (Interpretation, FollowUpMessage, AIDailyUsage), `20260923183900_add_arcana_calculations` (`ArcanaCalculation` → tabela `arcana_calculations`, FK `userId` → `User` com `ON DELETE CASCADE`, índice `(userId, createdAt)`; a mesma migration corrigiu drift de índices faltantes: `follow_up_messages("interpretationId")`, `reading_cards("readingId")` e removeu `interpretations_cacheHash_idx`).

Geradas com atomic chain da skill `prisma` e todas aplicadas em dev PostgreSQL em 2026-09-23 (a de arcano foi a última; as três anteriores estavam pendentes de aplicação). SQL real versionado em `prisma/migrations/<nome>/migration.sql`. Em `GET /api/v1/arcana/calculate` há **duas** gravações não-bloqueantes: (1) o cache `User.personalArcana` — apenas quando ainda estava `null`, nunca sobrescrevendo valor existente (fix 2026-09-25) — e (2) o histórico em `arcana_calculations`. A resposta inclui `reductionDate`/`reductionName`.

### Sprint 1 — Leituras e Cartas (rascunho de planejamento — superado)

> **Nota (2026-09-23):** seção histórica de planejamento. As migrations reais aplicadas estão na subsection acima; `ArcanaCalculation` foi criada por `20260923183900_add_arcana_calculations` (tabela `arcana_calculations`), não pelo bloco ilustrativo abaixo. Decks continuam em JSON — `TarotDeck`/`Card`/`Spread`/`DailyCard` **não** foram criados.

**Migration (planejada, nunca gerada)**: `20250711010000_add_reading_tables`

Entidades: `TarotDeck`, `Card`, `Spread`, `Reading`, `ArcanaCalculation`, `DailyCard`

```sql
-- Criar tabela TarotDeck
CREATE TABLE "TarotDeck" ( ... );

-- Criar tabela Card
CREATE TABLE "Card" ( ... );

-- Criar tabela Spread
CREATE TABLE "Spread" ( ... );

-- Criar tabela Reading
CREATE TABLE "Reading" ( ... );

-- Criar tabela ArcanaCalculation
CREATE TABLE "ArcanaCalculation" ( ... );

-- Criar tabela DailyCard
CREATE TABLE "DailyCard" ( ... );

-- Criar tabela HoroscopeEntry
CREATE TABLE "HoroscopeEntry" ( ... );
```

### Sprint 2 — Social & Horóscopos — ✅ APLICADA (2026-09-26, Phase 0)

**Migration**: `20260926182325_sprint2_social_horoscopes` — aplicada em dev (`npx prisma migrate status` → up-to-date; **7 migrations** na chain **na data do Phase 0** — hoje são **9**: seguem `20260927222620_sprint2_review_fixes` e `20260928004004_horoscope_contents_domain_checks`, ver §11 e §1). Cria os **13 models** novos do Phase 0 (T001–T014): `Follow`, `Post`, `Comment`, `PostLike`, `CommentLike`, `PostHashtag`, `Gift`, `Notification`, `ContentReport` (social) e `HoroscopeContent`, `HoroscopeEntry`, `HoroscopeLog`, `HoroscopeNotification` (horóscopos), além de campos novos:

- `User`: `subscriptionTier UserPlan @default(FREE)`, `isBanned`, `bannedAt`, `banReason`, `maxFollowing Int @default(5000)`
- `UserProfile`: `versosBalance Int @default(0)`, `versosStreak Int @default(0)`, `lastClaimAt DateTime?`

Gerada com `npx prisma migrate dev --name sprint2_social_horoscopes` (T015; sem `db push`); SQL real versionado em `prisma/migrations/20260926182325_sprint2_social_horoscopes/migration.sql`. Índices/úniques entregues junto (T016): `Post(authorId,createdAt)`, `Post(createdAt)`, `Follow(followerId)`, `Follow(followingId)`, `Notification(userId,isRead,createdAt)`, `PostHashtag(tag)`, `HoroscopeEntry(userId,createdAt)`, `HoroscopeLog(userId,createdAt)`, `Gift(toUserId,createdAt)`, `ContentReport(targetType,targetId)`, únicos `Follow(followerId,followingId)`, `PostLike(postId,userId)`, `CommentLike(commentId,userId)`, `HoroscopeContent(type,signId,element,period,date)`, `HoroscopeNotification(userId)`.

> **Backfill de `User.mayanKin`**: a troca de epoch do Kin Maya para a **correlação GMT 584283** (Phase 0 — AC-11/RF-HORO-004) invalida valores calculados antes do Sprint 2. O script pontual `prisma/backfill-mayankin.ts` recalcula tudo a partir da fonte única `calculateKinMaya` — `npx tsx prisma/backfill-mayankin.ts` (**dry-run por padrão**, sem flag) → `npx tsx prisma/backfill-mayankin.ts --apply` (grava; idempotente — em dev foi validado com `1990-06-15 → Kin 255` e revertido). Guard de execução direta (importar o módulo não roda o backfill) e e-mails mascarados no stdout (LGPD, `maskEmail`). **Não é migration**: roda sob demanda em cada ambiente que tenha dados pré-existentes.

### Sprint 2 — Social (rascunho de planejamento — superado)

> **Nota (2026-09-26):** seção histórica de planejamento. A migration real é `20260926182325_sprint2_social_horoscopes` (subsection acima), não `20250712000000_add_social_tables`, e o escopo real inclui likes/comentários/denúncias/horóscopos além de `Follow`/`Post`/`Comment`/`Gift`/`Notification`.

**Migration (planejada, nunca gerada)**: `20250712000000_add_social_tables`

Entidades: `Follow`, `Post`, `Comment`, `Gift`, `Notification`

### Sprint 3 — Marketplace e Pagamentos

**Migration**: `20250712010000_add_marketplace_tables`

Entidades: `Product`, `Order`, `Payment`

### Sprint 4 — Assinaturas

**Migration**: `20250713000000_add_subscription_table`

Entidade: `Subscription`

---

## 6. Data Seeding

O arkana-agora requer dados iniciais para funcionar. O seeding é feito via `prisma db seed`.

### 6.1 Comando

> ⚠️ **Envs:** o Prisma CLI e `tsx` **não** carregam `.env.local` — use o arquivo `.env` na raiz (copie de `.env.example`). Sem ele, `migrate dev`/`db seed` falham com `Environment variable not found: DATABASE_URL`.

```bash
# Executar seed completo
bunx prisma db seed

# Configuração no package.json (já presente no esqueleto)
# "prisma": { "seed": "bunx tsx prisma/seed.ts" }
# scripts.seed usa o mesmo comando: "seed": "bunx tsx prisma/seed.ts"
```

### 6.2 Dados de Seed

> **Estado atual (Sprint 2 / Phase 0.5, 2026-09-26):** o `prisma/seed.ts` real cria **1 admin + 1 test user** via `upsert` idempotente (com `UserProfile` aninhado; `providerId` EMAIL = email lowercase, H-2) e, desde o Sprint 2, também: (1) `HoroscopeNotification` **defaults** para os usuários do seed (`westernEnabled=true`, `chineseEnabled=false`, `mayaEnabled=false`, `hour=7` — `upsert`, idempotente); (2) **fallbacks de `HoroscopeContent`** — o Phase 0 criou 24 linhas western daily e o **Phase 0.5 (T032)** estendeu para **1328 linhas**: (12 signos ocidentais + 60 combos chineses + 260 kins maia) × (`daily` em **2** datas civis BRT + `weekly` + `monthly`), `date` em `America/Sao_Paulo` (helpers `civilDateBrt()`/`civilIsoWeek()`/`civilMonth()` — movidos no review para **`src/lib/horoscopes/dates.ts`**, single-source p/ seed/backfill/future crons), query-then-`createMany` idempotente (rodar o seed 2ª vez → 0 linhas novas). **Garantias no banco (review Step 5)**: a unique de `horoscope_contents(type, signId, element, period, date)` foi recriada com **`NULLS NOT DISTINCT`** (`20260927222620` — sem isso o Postgres trata `element IS NULL` como distintos e a idempotência não valia para western/maya) e os domínios têm **CHECKs** (`type`/`period` em `20260928004004`; demais CHECKs da mesma migration de review). — pré-existem ao cron 04:00 BRT para a página nunca retornar vazio. **Catálogos vivem em código** (`src/lib/horoscopes/western.ts`, `chinese.ts`, `maya.ts`), não no seed; o **catálogo de gifts SPEC-007** (6 itens) também é código, em `src/lib/social/gifts.ts` (T036, Phase 0.5 — **não é semeado**), e as **palavras de moderação** são env `MODERATION_BLOCKED_WORDS` consumida por `src/lib/moderation.ts` (T025). Os dados de baralhos/spreads/astrologia abaixo continuam sendo o **plano de seed** para quando essas entidades forem migradas.

#### Baralho Rider-Waite-Smith (78 cartas)

**Arcanos Maiores (22 cartas)**:

| # | Nome (PT-BR) | Naipe |
|---|-------------|-------|
| 0 | O Louco | MAJOR_ARCANA |
| 1 | O Mago | MAJOR_ARCANA |
| 2 | A Sacerdotisa | MAJOR_ARCANA |
| 3 | A Imperatriz | MAJOR_ARCANA |
| 4 | O Imperador | MAJOR_ARCANA |
| 5 | O Hierofante | MAJOR_ARCANA |
| 6 | Os Enamorados | MAJOR_ARCANA |
| 7 | O Carro | MAJOR_ARCANA |
| 8 | A Força | MAJOR_ARCANA |
| 9 | O Eremita | MAJOR_ARCANA |
| 10 | A Roda da Fortuna | MAJOR_ARCANA |
| 11 | A Justiça | MAJOR_ARCANA |
| 12 | O Enforcado | MAJOR_ARCANA |
| 13 | A Morte | MAJOR_ARCANA |
| 14 | A Temperança | MAJOR_ARCANA |
| 15 | O Diabo | MAJOR_ARCANA |
| 16 | A Torre | MAJOR_ARCANA |
| 17 | A Estrela | MAJOR_ARCANA |
| 18 | A Lua | MAJOR_ARCANA |
| 19 | O Sol | MAJOR_ARCANA |
| 20 | O Julgamento | MAJOR_ARCANA |
| 21 | O Mundo | MAJOR_ARCANA |

**Arcanos Menores (56 cartas)**: 4 naipes × 14 cartas cada (Ás a 10 + Valete, Cavaleiro, Rainha, Rei)

#### Baralho Cigano Lenormand (36 cartas)

| # | Nome (PT-BR) |
|---|-------------|
| 1 | O Cavaleiro |
| 2 | O Trevo |
| 3 | O Navio |
| 4 | A Casa |
| 5 | A Árvore |
| 6 | As Nuvens |
| 7 | A Serpente |
| 8 | O Caixão |
| 9 | O Buquê |
| 10 | A Foice |
| 11 | O Chicote |
| 12 | Pássaros |
| 13 | A Criança |
| 14 | A Raposa |
| 15 | Urso |
| 16 | Estrelas |
| 17 | Cegonha |
| 18 | Cachorro |
| 19 | Torre |
| 20 | Jardim |
| 21 | Montanha |
| 22 | Caminhos |
| 23 | Rato |
| 24 | Coração |
| 25 | Anel |
| 26 | Livro |
| 27 | Carta |
| 28 | Homem |
| 29 | Mulher |
| 30 | Lírios |
| 31 | Sol |
| 32 | Lua |
| 33 | Chave |
| 34 | Peixes |
| 35 | Âncora |
| 36 | Cruz |

#### Templates de Spreads

| Nome | Cartas | Categoria | Premium |
|------|:-------:|-----------|:------:|
| Carta Única | 1 | GENERAL | Não |
| Tire Três | 3 | GENERAL | Não |
| Cruz Celta | 10 | GENERAL | Sim |
| Leitura do Amor | 5 | LOVE | Não |
| Sim ou Não | 1 | CUSTOM | Não |
| Carreira | 4 | CAREER | Não |
| Espiritual | 7 | SPIRITUAL | Sim |

#### Dados Astrológicos

**Signos do Zodíaco**:

| Signo | Elemento | Data Início | Data Fim | Regente |
|-------|----------|-------------|---------|--------|
| Áries | Fogo | 21/03 | 19/04 | Marte |
| Touro | Terra | 20/04 | 20/05 | Vênus |
| Gêmeos | Ar | 21/05 | 20/06 | Mercúrio |
| Câncer | Água | 21/06 | 22/07 | Lua |
| Leão | Fogo | 23/07 | 22/08 | Sol |
| Virgem | Terra | 23/08 | 22/09 | Mercúrio |
| Libra | Ar | 23/09 | 22/10 | Vênus |
| Escorpião | Água | 23/10 | 21/11 | Plutão |
| Sagitário | Fogo | 22/11 | 21/12 | Júpiter |
| Capricórnio | Terra | 22/12 | 19/01 | Saturno |
| Aquário | Ar | 20/01 | 18/02 | Urano |
| Peixes | Água | 19/02 | 20/03 | Netuno |

> ⚠️ **Catálogos agora vivem em código (Sprint 2 Phase 0).** As tabelas abaixo são o **rascunho pré-Sprint 2** — a fonte de verdade é `src/lib/horoscopes/{western,chinese,maya}.ts` (exigência: `.specs/006-horoscopes/requirements.md` RF-HORO-003/RF-HORO-002). Divergências já conhecidas do rascunho: a coluna "Tom" da tabela de selos na verdade repete o id do selo; as colunas "Poder"/"Ação" dos tons não correspondem a `power`/`action` do código em todas as linhas; e o nome do Tom 5 é **Ondulado** (não "Harmônico" — Harmónico é o Tom 8). Não copie estes valores para o seed: os catálogos são literais em código e cobertos por `tests/horoscopes.test.ts`.

**Selos Solares Maias (20 selos)**:

| # | Nome | Cor | Tom | Atributo |
|---|------|-----|-----|---------|
| 1 | Dragão Vermelho | Vermelho | 1 | Nascimento |
| 2 | Vento Branco | Branco | 2 | Espírito |
| 3 | Noite Azul | Azul | 3 | Sonho |
| 4 | Semente Amarela | Amarelo | 4 | Florescimento |
| 5 | Serpente Vermelha | Vermelho | 5 | Sobrevivência |
| 6 | Enlaçador de Mundos Branco | Branco | 6 | Morte |
| 7 | Mão Azul | Azul | 7 | Conhecimento |
| 8 | Estrela Amarela | Amarelo | 8 | Arte |
| 9 | Lua Vermelha | Vermelho | 9 | Purificação |
| 10 | Cachorro Branco | Branco | 10 | Lealdade |
| 11 | Macaco Azul | Azul | 11 | Brincadeira |
| 12 | Humano Amarelo | Amarelo | 12 | Livre-arbítrio |
| 13 | Caminhante do Céu Vermelho | Vermelho | 13 | Espaço |
| 14 | Mago Branco | Branco | 14 | Feitiçaria |
| 15 | Águia Azul | Azul | 15 | Visão |
| 16 | Guerreiro Amarelo | Amarelo | 16 | Inteligência |
| 17 | Terra Vermelha | Vermelho | 17 | Navegação |
| 18 | Espelho Branco | Branco | 18 | Reflexão |
| 19 | Tormenta Azul | Azul | 19 | Transformação |
| 20 | Sol Amarelo | Amarelo | 20 | Iluminação |

**Tons Galácticos (13 tons)**:

| Tom | Nome | Poder | Ação |
|-----|------|-------|-------|
| 1 | Magnético | Unificar | Atrair |
| 2 | Lunar | Polarizar | Estabilizar |
| 3 | Elétrico | Ativar | Vincular |
| 4 | Autoexistente | Definir | Medir |
| 5 | Ondulado | Comandar | Empoderar |
| 6 | Rítmico | Organizar | Equilibrar |
| 7 | Ressonante | Canalizar | Inspirar |
| 8 | Galáctico | Harmonizar | Modelar |
| 9 | Solar | Pulsar | Realizar |
| 10 | Planetário | Perfurar | Produzir |
| 11 | Espectral | Dissolver | Libertar |
| 12 | Cristal | Dedicar | Universalizar |
 | 13 | Cósmico | Endurecer | Transcender |

---

## 7. Estrutura do Script de Seed

```typescript
// prisma/seed.ts — recorte do estado real: upserts de usuário (Sprint 0/F1),
// que o Sprint 2 preservou. A partir do Sprint 2 o arquivo também importa
// "dotenv/config", usa o singleton de `../src/lib/prisma` e chama
// seedHoroscopeNotifications() + seedHoroscopeFallbacks() após os upserts.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@arkanaagora.dev";
const TEST_EMAIL = "test@arkanaagora.dev";

export async function seed(): Promise<void> {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      name: "Admin",
      displayName: "Admin",
      provider: "EMAIL",
      providerId: ADMIN_EMAIL, // providerId EMAIL = email lowercase (H-2)
      role: "ADMIN",
      emailVerified: new Date(),
      profile: { create: {} }, // UserProfile 1:1 aninhado
    },
  });

  const test = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: {
      email: TEST_EMAIL,
      name: "Test User",
      displayName: "Test User",
      provider: "EMAIL",
      providerId: TEST_EMAIL,
      role: "USER",
      emailVerified: new Date(),
      profile: { create: {} },
    },
  });

  console.log(`Seed ok: admin=${admin.email} | test=${test.email}`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

> **Acrescentado no Sprint 2 (Phase 0)** — o bloco acima mostra só os upserts de usuário. O `seed()` real chama em seguida:
>
> ```typescript
> await seedHoroscopeNotifications([admin.id, test.id]); // defaults HoroscopeNotification
> await seedHoroscopeFallbacks();                        // 1328 HoroscopeContent (Phase 0.5 / T032)
> ```
>
> `seedHoroscopeFallbacks()` varre `FALLBACK_PERIODS = ["daily","weekly","monthly"]` e, para cada período, gera as linhas com `buildWesternFallback(index, date, period)` (12 signos), `buildChineseFallback(...)` (60 combos) e `buildMayaFallback(...)` (260 kins) — 1328 linhas no total (`daily` usa 2 datas civis BRT, `weekly` a ISO week e `monthly` o mês civil, via `civilDateBrt()`/`civilIsoWeek()`/`civilMonth()`). Só insere o que ainda não existe (checa `findMany` antes do `createMany`; chave `type|signId|element|period|date`) — rodar o seed duas vezes não duplica linhas (2ª execução: 0 inseridas). **Os templates de fallback ficam fora da validação de palavras do T035** (decisão 2026-09-26 — a validação vale para conteúdo gerado por IA).

---

## 9. Execution Log — Review-Fix Batch (2026-09-25)

**Batch**: Meu Arcano / Google batch fixes — self-heal CAS, null-out semantics, prefill via useMyProfile, dirty invariant, enrichment validation, arcana range 1-22 enforcement, security headers, drift fixes.

**Schema changes**: Nenhuma migration nova — todas as mudanças são comportamentais (código) sobre schema existente. As entidades afetadas (`User.personalArcana`, `ArcanaCalculation.arcanaNumber`) já existem; os fixes ajustam:
- `User.personalArcana`: self-heal CAS no read (`GET /arcana/calculate`), null-out explícito no PATCH `/me/profile` quando `name` vazio, invalidação condicional no enrichment OAuth.
- `ArcanaCalculation.arcanaNumber`: constraint conceitual `min 1, max 22` (o cálculo nunca emite 0; 22 = "O Louco" número mestre).
- `next.config.ts`: security headers (HSTS, X-Content-Type-Options, Referrer-Policy) — sem schema change.

**Verificação**:
- TypeScript: `npx tsc --noEmit` ✅
- Lint: `npx eslint` ✅
- Tests: `npx vitest run` ✅ (arcana, profile, auth, enrichment tests passing)
- Prisma migrate status: ✅ up to date (no pending migrations)

**Documentação atualizada**: `docs/04-api/users.md`, `docs/06-features/profile.md`, `docs/04-api/ai.md`, `docs/modules/auth.md`, `docs/03-database/entities.md`, `docs/plans/20260921120000-sprint1-completion-plan.md`, `docs/work-plans/20260921120000-sprint1-completion-work-plan.md`, `docs/solutions/patterns/` (TZ determinism + derived-field invalidation patterns).

---

## 10. Execution Log — Sprint 2 Phase 0 (2026-09-26)

**Batch**: Social & Horóscopos — T001–T023 (`docs/plans/20260926120000-sprint2-execution-plan.md`).

**Schema changes**: **1 migration nova** — `20260926182325_sprint2_social_horoscopes` (13 models + campos `User`/`UserProfile`, detalhes na §5). Gerada com `npx prisma migrate dev --name sprint2_social_horoscopes`, aplicada em dev; `npx prisma migrate status` → up-to-date (7 migrations na chain). `prisma generate` re-executado após a mudança (client desatualizado).

**Seed**: `prisma/seed.ts` estendido (usuários admin/test preservados + `HoroscopeNotification` defaults + 24 fallbacks `HoroscopeContent` western daily de hoje/amanhã em data civil BRT, idempotente). Executado em dev — 2ª passada sem duplicar linhas.

> ⚠️ Este log registra o estado do **Phase 0**. No **Phase 0.5 (T032)** o seed foi ampliado para **1328 fallbacks** (12 zodíacos ocidentais + 60 chineses + 260 mayas × daily×2 + weekly + monthly, helpers `civilDateBrt()`/`civilIsoWeek()`/`civilMonth()`), idempotente — estado atual em §6.2.

**Fora do schema (código puro)**: catálogos/algoritmos `src/lib/horoscopes/{western,chinese,maya}.ts`, validação de env `src/lib/env.ts`, testes `tests/horoscopes.test.ts`.

**Mudança de contrato**: epoch do Kin Maya trocada para a **correlação GMT 584283** (`GMT_CORRELATION_JDN` em `src/lib/horoscopes/maya.ts`); `src/lib/calculations/kin-maya.ts` agora **delega** para `gregorianToMayanLongCount()` mantendo a assinatura `calculateKinMaya(birthDate): number | null`. Valores antigos de `User.mayanKin` ficam stale → backfill via `prisma/backfill-mayankin.ts` (ver §5).

**Verificação**:
- Lint: ✅ | Type-check: ✅
- Tests: ✅ 1781 testes (baseline 1124; `tests/horoscopes.test.ts` = 658)
- Prisma migrate status: ✅ up to date (no pending migrations)

**Documentação atualizada**: `docs/03-database/{migrations,entities,relationships,indexing,erd}.md`, `docs/06-features/profile.md`, `docs/01-product/{business-rules,use-cases}.md`, `docs/00-overview/glossary.md`, `docs/solutions/patterns/calculation/tz-determinism-utc-tests.md`, `docs/02-architecture/deployment.md`, `docs/08-sprints/sprint-2.md`.

---

## 11. Execution Log — Sprint 2 Review Fixes (2026-09-27/28)

**Batch**: Correções da review multi-agente Step 4/5 (data-integrity C1/CRIT-2, lint, security, architecture).

**Schema changes**: **2 migrations novas** (ambas geradas via CLI + SQL customizado anexado — skill `prisma`):

1. `20260927222620_sprint2_review_fixes` — índice `gifts("fromUserId","createdAt")` (fallback Prisma do limite de gifts, I5); dedupe defensivo + recriação da unique de `horoscope_contents` com **`NULLS NOT DISTINCT`** (C1/CRIT-2: sem ela, as 1000+ linhas `element IS NULL` de western/maya ficavam sem backstop de unicidade); **7 CHECKs** de domínio documentados nos comentários do `schema.prisma`: `posts(type/audience)`, `notifications(type)`, `content_reports(targetType/status)`, `UserProfile_versosBalance_nonneg` (S2-17), `horoscope_notifications_hour_range` (0–23).
2. `20260928004004_horoscope_contents_domain_checks` — CHECKs `type IN ('western','chinese','maya')` e `period IN ('daily','weekly','monthly')` (I6; dados existentes verificados no domínio antes do `ADD CONSTRAINT`). Estender um domínio exige migration futura (`DROP CONSTRAINT` + `ADD CONSTRAINT`).

**Gate de drift (data N12)**: `.github/workflows/ci.yml` (job Testes, após `migrate deploy`) agora roda `prisma migrate status` + `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` — drift migrations×schema×DB vira falha de build.

**Verificação**:
- Lint: ✓ | Type-check: ✓ | Prettier: ✓ (`prettier --check .` 0)
- Prisma migrate status: ✓ 9 migrations, up to date
- `prisma migrate diff` (datasource→schema): ✓ "No difference detected" (exit 0)
- Testes: ✓ suíte completa

**Documentação atualizada**: `docs/03-database/migrations.md` (§1/§2/§6.2/§11), banners de chain (9 migrations) em `entities/relationships/indexing/erd.md`.

*Documento parte do SDD (Software Design Document) do arkana-agora.*
