# Diagrama ERD — arkana-agora

> Versão: 1.0 | Última atualização: 2026-08-12

---

> **Status:** **5 models implementados** — `User`, `UserProfile`, `Subscription`, `Session`, `VerificationToken` (init migration `20260813000605_init` aplicada em dev PostgreSQL). As outras **13 entidades estão planejadas** e não existem ainda no schema. `Session`/`VerificationToken` **não têm seção aqui** — são cópia de `.specs/001-auth/design.md` §4 (rotas custom `/api/v1/auth/*`, ADR-009). Consulte `prisma/schema.prisma` para o que está realmente implementado.

---

## 1. Visão Geral

O banco de dados do arkana-agora possui **18 entidades** organizadas em **5 domínios**:

| Domínio | Entidades |
|---------|-----------|
| **Autenticação & Usuário** | User, UserProfile, Subscription |
| **Leituras & Tarot** | Reading, Card, TarotDeck, Spread, ArcanaCalculation, HoroscopeEntry, DailyCard |
| **Social** | Follow, Post, Comment, Notification, Gift |
| **Marketplace** | Product, Order, Payment |
| **Sistema** | (entidades técnicas se necessário) |

---

## 2. Diagrama ERD Completo (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              arkana-agora — Diagrama ERD                                 │
│                                                                                           │
│  LEGENDA:
│    PK = Primary Key    FK = Foreign Key    UQ = Unique    IDX = Indexado                 │
│    1:N = Um para Muitos    N:M = Muitos para Muitos (via tabela juntura)                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                           DOMÍNIO: AUTENTICAÇÃO & USUÁRIO                              ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  ┌─────────────────────────────┐       ┌─────────────────────────────┐                 ║
║  │          USER               │       │       USER_PROFILE           │                 ║
║  ├─────────────────────────────┤       ├─────────────────────────────┤                 ║
║  │ PK id (UUID)               │───1:1─│ FK userId (UUID)            │                 ║
║  │    email (UQ,IDX)          │       │    bio                      │                 ║
║  │    passwordHash?           │       │    location                 │                 ║
║  │    name                    │       │    website                  │                 ║
║  │    displayName             │       │    socialLinks (JSON)       │                 ║
║  │    avatar?                 │       │    skills (String[])        │                 ║
║  │    role (ENUM)             │       │    specialties (String[])   │                 ║
║  │    plan (ENUM)             │       │    rating (Decimal)         │                 ║
║  │    birthDate?              │       │    reviewCount (Int)        │                 ║
║  │    astrologicalSign?       │       │    pricePerReading (Dec)    │                 ║
║  │    mayanKin?               │       │    available (Boolean)      │                 ║
║  │    personalArcana?         │       │    languages (String[])     │                 ║
║  │    provider (ENUM)         │       └─────────────────────────────┘                 ║
║  │    providerId (UQ comp.)   │                                                     ║
║  │    emailVerified           │       ┌─────────────────────────────┐                 ║
║  │    isActive                │───1:1─│      SUBSCRIPTION            │                 ║
║  │    createdAt               │       ├─────────────────────────────┤                 ║
║  │    updatedAt               │       │ PK id (UUID)               │                 ║
║  └──────────┬──────────────────┘       │ FK userId (UUID)            │                 ║
║             │                          │    plan (ENUM)              │                 ║
║             │                          │    status (ENUM)            │                 ║
║             │                          │    startDate                │                 ║
║             │                          │    endDate                  │                 ║
║             │                          │    trialEnd                 │                 ║
║             │                          │    externalId               │                 ║
║             │                          └─────────────────────────────┘                 ║
╚═════════════╪═══════════════════════════════════════════════════════════════════════════╝
              │
              │ 1:N (User tem muitas leituras, posts, etc.)
              │
╔═════════════╪═════════════════════════════════════════════════════════════════════════╗
║           ║                  DOMÍNIO: LEITURAS & TAROT                                ║
╠═════════════╪═════════════════════════════════════════════════════════════════════════╣
║           ║                                                                              ║
║           ║  ┌────────────────────────┐     ┌────────────────────────┐                ║
║           ║  │      TAROT_DECK        │     │        CARD             │                ║
║           ║  ├────────────────────────┤     ├────────────────────────┤                ║
║           ║  │ PK id (UUID)           │──1:N─│ PK id (UUID)            │                ║
║           ║  │    name                 │     │ FK deckId (UUID)        │                ║
║           ║  │    type (ENUM)          │     │    name                  │                ║
║           ║  │    description          │     │    number                │                ║
║           ║  │    cardCount (Int)      │     │    suit (ENUM)           │                ║
║           ║  │    isActive (Bool)      │     │    meaning_upright       │                ║
║           ║  └────────────────────────┘     │    meaning_reversed      │                ║
║           ║                                  │    keywords (JSON)       │                ║
║           ║  ┌────────────────────────┐     │    imageUrl              │                ║
║           ║  │       SPREAD           │     └───────────┬────────────┘                ║
║           ║  ├────────────────────────┤                 │                           ║
║           ║  │ PK id (UUID)           │                 │ N:M (Leitura usa Cartas)   ║
║           ║  │    name                 │                 │                           ║
║           ║  │    cardCount (Int)      │     ┌───────────▼────────────┐                ║
║           ║  │    positions (JSON)     │     │       READING            │                ║
║           ║  │    description          │     ├────────────────────────┤                ║
║           ║  │    isPremium (Bool)     │     │ PK id (UUID)            │                ║
║           ║  │    category (ENUM)      │     │ FK userId (UUID)        │                ║
║           ║  └────────────────────────┘     │    spreadType (ENUM)     │                ║
║           ║                                  │    cards (JSON)          │◄─ Card[]       ║
║           ║                                  │    interpretation        │                ║
║           ║                                  │    mood (ENUM)           │                ║
║           ║                                  │    isPublic (Bool)       │                ║
║           ║                                  │    aiModel               │                ║
║           ║                                  │    tokensUsed (Int)      │                ║
║           ║                                  │    createdAt             │                ║
║           ║                                  └────────────────────────┘                ║
║           ║                                                                       ║
║           ║  ┌──────────────────────────┐  ┌──────────────────────────┐             ║
║           ║  │  ARCANA_CALCULATION      │  │   HOROSCOPE_ENTRY        │             ║
║           ║  ├──────────────────────────┤  ├──────────────────────────┤             ║
║           ║  │ PK id (UUID)             │  │ PK id (UUID)             │             ║
║           ║  │ FK userId (UUID)         │  │ FK userId (UUID)         │             ║
║           ║  │    birthDate             │  │    type (ENUM)            │             ║
║           ║  │    fullName              │  │    zodiacSign             │             ║
║           ║  │    reductionDate         │  │    chineseAnimal          │             ║
║           ║  │    reductionName         │  │    mayanKin               │             ║
║           ║  │    arcanaNumber (Int)    │  │    content (JSON)         │             ║
║           ║  │    arcanaName            │  │    sourceDate             │             ║
║           ║  │    description           │  │    createdAt              │             ║
║           ║  │    createdAt             │  └──────────────────────────┘             ║
║           ║  └──────────────────────────┘                                          ║
║           ║  ┌──────────────────────────┐                                          ║
║           ║  │      DAILY_CARD          │                                          ║
║           ║  ├──────────────────────────┤                                          ║
║           ║  │ PK id (UUID)             │                                          ║
║           ║  │    date (UQ,IDX)         │                                          ║
║           ║  │ FK cardId (UUID)         │                                          ║
║           ║  │    interpretation         │                                          ║
║           ║  │    createdAt             │                                          ║
║           ║  └──────────────────────────┘                                          ║
╚═══════════╪═════════════════════════════════════════════════════════════════════════╝
            │
            │
╔═══════════╪═════════════════════════════════════════════════════════════════════════╗
║           ║                     DOMÍNIO: SOCIAL                                     ║
╠═══════════╪═════════════════════════════════════════════════════════════════════════╣
║           ║                                                                              ║
║           ║  ┌────────────────────────┐     ┌────────────────────────┐                ║
║           ║  │        FOLLOW           │     │         POST             │                ║
║           ║  ├────────────────────────┤     ├────────────────────────┤                ║
║           ║  │ PK id (UUID)           │     │ PK id (UUID)            │                ║
║           ║  │ FK followerId (User)    │     │ FK authorId (User)       │                ║
║           ║  │ FK followingId (User)   │     │ FK readingId (null)     │                ║
║           ║  │    createdAt            │     │    content (Text)        │                ║
║           ║  └───┬────────────────────┘     │    images (JSON)          │                ║
║           ║      │                          │    likesCount (Int)       │                ║
║           ║      │ UQ(follower,following)   │    commentsCount (Int)    │                ║
║           ║      │                          │    isPublic (Bool)        │                ║
║           ║      │                          │    createdAt              │                ║
║           ║      │                          │    updatedAt              │                ║
║           ║      │                          └───────────┬────────────┘                ║
║           ║      │                                      │ 1:N                          ║
║           ║      │                          ┌───────────▼────────────┐                ║
║           ║      │                          │       COMMENT           │                ║
║           ║      │                          ├────────────────────────┤                ║
║           ║      │                          │ PK id (UUID)            │                ║
║           ║      │                          │ FK postId (UUID)        │                ║
║           ║      │                          │ FK authorId (User)       │                ║
║           ║      │                          │    content (Text)        │                ║
║           ║      │                          │    createdAt              │                ║
║           ║      │                          │    updatedAt              │                ║
║           ║      │                          └────────────────────────┘                ║
║           ║                                                                       ║
║           ║  ┌────────────────────────┐  ┌────────────────────────┐                ║
║           ║  │        GIFT            │  │     NOTIFICATION        │                ║
║           ║  ├────────────────────────┤  ├────────────────────────┤                ║
║           ║  │ PK id (UUID)           │  │ PK id (UUID)            │                ║
║           ║  │ FK senderId (User)      │  │ FK userId (User)        │                ║
║           ║  │ FK receiverId (User)    │  │    type (ENUM)           │                ║
║           ║  │    giftType             │  │    title                 │                ║
║           ║  │    message              │  │    body                  │                ║
║           ║  │    createdAt            │  │    data (JSON)           │                ║
║           ║  └────────────────────────┘  │    isRead (Bool,IDX)     │                ║
║           ║                              │    createdAt             │                ║
║           ║                              └────────────────────────┘                ║
╚═══════════╪═════════════════════════════════════════════════════════════════════════╝
            │
╔═══════════╪═════════════════════════════════════════════════════════════════════════╗
║           ║                    DOMÍNIO: MARKETPLACE                                  ║
╠═══════════╪═════════════════════════════════════════════════════════════════════════╣
║           ║                                                                              ║
║           ║  ┌────────────────────────┐     ┌────────────────────────┐                ║
║           ║  │       PRODUCT           │     │        ORDER             │                ║
║           ║  ├────────────────────────┤     ├────────────────────────┤                ║
║           ║  │ PK id (UUID)           │──1:N─│ PK id (UUID)            │                ║
║           ║  │ FK sellerId (User)      │     │ FK buyerId (User)        │                ║
║           ║  │    name (IDX,FTS)       │     │ FK productId (UUID)      │                ║
║           ║  │    description (FTS)    │     │    amount (Decimal)       │                ║
║           ║  │    price (Decimal)      │     │    status (ENUM)         │                ║
║           ║  │    category             │     │ FK paymentId (null)      │                ║
║           ║  │    images (JSON)        │     │    createdAt              │                ║
║           ║  │    isActive (Bool)      │     │    updatedAt              │                ║
║           ║  │    createdAt            │     └───────────┬────────────┘                ║
║           ║  └────────────────────────┘                 │ 1:1 (opcional)           ║
║           ║                                             │                           ║
║           ║                              ┌────────────▼─────────────┐                ║
║           ║                              │        PAYMENT           │                ║
║           ║                              ├──────────────────────────┤                ║
║           ║                              │ PK id (UUID)             │                ║
║           ║                              │ FK userId (User)         │                ║
║           ║                              │ FK orderId (null)        │                ║
║           ║                              │    amount (Decimal)       │                ║
║           ║                              │    method (ENUM)          │                ║
║           ║                              │    status (ENUM)          │                ║
║           ║                              │    externalId             │                ║
║           ║                              │    metadata (JSON)        │                ║
║           ║                              │    createdAt              │                ║
║           ║                              └──────────────────────────┘                ║
╚═══════════╪═════════════════════════════════════════════════════════════════════════╝
            │
            ▼
     (User conecta todos os domínios)
```

---

## 3. Legenda

### 3.1 Tipos de Chave

| Símbolo | Significado | Exemplo |
|----------|-------------|---------|
| **PK** | Primary Key — identificador único da entidade | `id UUID` |
| **FK** | Foreign Key — referência a outra entidade | `userId UUID` |
| **UQ** | Unique — valor único na tabela | `email` |
| **IDX** | Indexado — consulta otimizada | `createdAt` |
| **FTS** | Full-Text Search — busca textual | `content` |

### 3.2 Relacionamentos

| Símbolo | Significado | Exemplo |
|----------|-------------|---------|
| **1:1** | Um para um | User ↔ UserProfile, User ↔ Subscription |
| **1:N** | Um para muitos | User → Reading, User → Post, Deck → Card |
| **N:M** | Muitos para muitos | User ↔ User (via Follow) |

### 3.3 Notação de Nulidade

| Símbolo | Significado |
|----------|-------------|
| `?` após campo | Campo opcional (nullable) |
| Sem `?` | Campo obrigatório (NOT NULL) |

---

## 4. Domínios Resumidos

```
                    ┌──────────┐
                    │   USER   │
                    │  (núcleo)│
                    └────┬─────┘
         ┌───────────┬───┴────┬────────────┬──────────────┐
         ▼           ▼        ▼            ▼              ▼
   ┌──────────┐ ┌────────┐ ┌───────┐ ┌─────────┐ ┌──────────┐
   │ LEITURAS │ │ SOCIAL │ │MKTPLACE│ │ PERFIL  │ │ ASSIN.   │
   │          │ │        │ │       │ │         │ │          │
   │ Reading  │ │ Follow │ │Product │ │UserProfile│Subscription│
   │ Card     │ │ Post   │ │ Order  │ │         │ │          │
   │ Deck     │ │Comment │ │Payment │ │         │ │          │
   │ Spread   │ │ Gift   │ │       │ │         │ │          │
   │ Arcana   │ │ Notif. │ │       │ │         │ │          │
   │ Horosc.  │ │        │ │       │ │         │ │          │
   │ DailyCard│ │        │ │       │ │         │ │          │
   └──────────┘ └────────┘ └───────┘ └─────────┘ └──────────┘
```

---

## 5. Enumeradores

| Enum | Valores |
|------|---------|
| `UserRole` | `USER`, `PROFESSIONAL`, `ADMIN` |
| `UserPlan` | `FREE`, `PLUS` |
| `AuthProvider` | `EMAIL`, `GOOGLE`, `FACEBOOK` |
| `SpreadType` | `SINGLE`, `THREE_CARD`, `CELTIC_CROSS`, `LOVE`, `YES_NO`, `CUSTOM` |
| `ReadingMood` | `GENERAL`, `LOVE`, `CAREER`, `HEALTH`, `SPIRITUAL` |
| `CardSuit` | `MAJOR_ARCANA`, `WANDS`, `CUPS`, `SWORDS`, `PENTACLES` |
| `DeckType` | `RIDER_WAITE`, `THOTH`, `LENORMAND`, `CUSTOM_MYSTIC` |
| `SpreadCategory` | `GENERAL`, `LOVE`, `CAREER`, `SPIRITUAL`, `CUSTOM` |
| `HoroscopeType` | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY` |
| `OrderStatus` | `PENDING`, `PAID`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `DISPUTED` |
| `PaymentMethod` | `MERCADO_PAGO`, `CREDIT_CARD`, `PIX` |
| `PaymentStatus` | `PENDING`, `APPROVED`, `REJECTED`, `REFUNDED`, `CANCELLED` |
| `NotificationType` | `LIKE`, `COMMENT`, `FOLLOW`, `GIFT`, `PAYMENT`, `READING`, `SYSTEM` |
| `SubscriptionStatus` | `ACTIVE`, `CANCELLED`, `EXPIRED`, `TRIAL` |

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*
