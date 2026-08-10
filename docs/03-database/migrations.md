# Estratégia de Migrações — arkana-agora

> Versão: 1.0 | Última atualização: 2025-07-11

---

## 1. Visão Geral

O arkana-agora utiliza **Prisma Migrate** para gerenciamento versionado do esquema do banco de dados. Todas as alterações de schema são rastreadas como arquivos de migration no repositório.

```
prisma/
├── schema.prisma          # Schema fonte de verdade
└── migrations/
    ├── 20250711000000_init/
    │   └── migration.sql   # Migration inicial
    ├── 20250711010000_add_reading_tables/
    │   └── migration.sql
    └── migration_lock.toml
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
| `20250711000000` | `init` | Criação inicial das tabelas de usuário e autenticação |
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
# Desenvolvimento: db push (sem migration files)
bunx prisma db push

# Quando quiser criar uma migration:
bunx prisma migrate dev --name descriptive_name

# Resetar banco de desenvolvimento (CUIDADO — apaga dados)
bunx prisma migrate reset
```

**Racional**: No desenvolvimento, `db push` sincroniza o schema sem gerar arquivos de migration, permitindo iteração rápida. `migrate dev` é usado quando a mudança é madura e precisa ser versionada.

### 3.2 Staging

```bash
# Aplicar migrações pendentes (sem interação)
bunx prisma migrate deploy

# Verificar status das migrações
bunx prisma migrate status
```

**Banco**: Neon PostgreSQL (branch de staging). Migrações aplicadas automaticamente no deploy de preview.

### 3.3 Produção

```bash
# Aplicar migrações (com backup prévio!)
bunx prisma migrate deploy
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

## 5. Próximas Migrations Planeadas

### Sprint 0 — Autenticação (MVP)

**Migration**: `20250711000000_init`

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

### Sprint 1 — Leituras e Cartas

**Migration**: `20250711010000_add_reading_tables`

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

### Sprint 2 — Social

**Migration**: `20250712000000_add_social_tables`

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

```bash
# Executar seed completo
bunx prisma db seed

# Configuração no package.json
# "prisma": { "seed": "bun run prisma/seed.ts" }
```

### 6.2 Dados de Seed

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

**Selos Solares Maias (20 selos)**:

| # | Nome | Cor | Tom | Atributo |
|---|------|-----|-----|---------|
| 1 | Dragão Vermelho | Vermelho | 1 | Nascimento |
| 2 | Vento Branco | Branco | 2 | Espírito |
| 3 | Noite Azul | Azul | 3 | Sonho |
| 4 | Semente Amarela | Amarelo | 4 | Florescimento |
| 5 | Serpente Vermelha | Vermelho | 5 | Sobrevivência |
| 6 | Enlace Mundial Branco | Branco | 6 | Morte |
| 7 | Mão Azul | Azul | 7 | Conhecimento |
| 8 | Estrela Amarela | Amarelo | 8 | Arte |
| 9 | Lua Vermelha | Vermelho | 9 | Purificação |
| 10 | Cão Branco | Branco | 10 | Lealdade |
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
| 5 | Harmônico | Comandar | Empoderar |
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
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do arkana-agora...');

  // 1. Criar baralhos
  await seedTarotDeck();
  await seedLenormandDeck();

  // 2. Criar spreads
  await seedSpreads();

  // 3. Criar dados astrológicos (tabelas de referência)
  // Nota: zodiac data é calculado em runtime, não armazenado como seed

  console.log('✅ Seed concluído com sucesso!');
}

async function seedTarotDeck() {
  const deck = await prisma.tarotDeck.create({
    data: {
      name: 'Rider-Waite-Smith',
      type: 'RIDER_WAITE',
      description: 'O baralho clássico de tarot, criado por Arthur Edward Waite e ilustrado por Pamela Colman Smith em 1909.',
      cardCount: 78,
      isActive: true,
      cards: {
        create: MAJOR_ARCANA_CARDS.map(card => ({
          name: card.name,
          number: card.number,
          suit: 'MAJOR_ARCANA',
          meaning_upright: card.upright,
          meaning_reversed: card.reversed,
          keywords: card.keywords,
          imageUrl: `https://assets.akashaverso.com.br/cards/rws/${card.number}.webp`,
        })),
      },
    },
  });
  console.log(`✅ Baralho RWS criado com ${deck.cardCount} cartas`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 8. Boas Práticas

### Regras de Migrations

1. **Nunca alterar migrations existentes** — criar nova migration para correções
2. **Migrations devem ser idempotentes** quando possível (`IF NOT EXISTS`, `IF EXISTS`)
3. **Migrations não devem conter dados** — dados são de responsabilidade do seed
4. **Sempre incluir rollback SQL** em comentário no arquivo de migration
5. **Manter migrations pequenas** — uma migration por alteração conceitual
6. **Revisar SQL gerado** pelo Prisma antes de commitar

### Rollback Manual

```bash
# Marcar migration como revertida (sem executar SQL)
bunx prisma migrate resolve --rolled-back 20250711010000_add_reading_tables

# Aplicar SQL de rollback manualmente
psql $DATABASE_URL -f prisma/migrations/20250711010000_rollback.sql
```

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*
