# SPEC-003: Motor de Tiragem -- Design Tecnico

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## 1. Componentes de Interface

### 1.1 DeckSelector
- Grid de 3 cards (um por baralho)
- Cada card com imagem de capa do baralho, nome, descricao curta e numero de cartas
- Selecionavel com borda destacada e animacao de escala (scale 1.02)
- Baralho selecionado persistido em localStorage
- Animacao de entrada: stagger 100ms entre cards

### 1.2 SpreadSelector
- Lista de espalhamentos disponiveis para o baralho selecionado
- Cada item com nome, numero de cartas, descricao e tempo estimado
- Badge de dificuldade: Iniciante / Intermediario / Avancado
- Filtro por numero de cartas (slider ou chips)

### 1.3 CardTable (Mesa de Tiragem)
- Area principal onde as cartas sao dispostas conforme o espalhamento
- Layout responsivo: posicoes calculadas com CSS Grid ou posicoes absolutas
- Background tematico com padrao sutil (estrelas, luas, etc.)
- Cartas nao reveladas exibem verso decorativo
- Z-index gerenciado para cartas em foco

### 1.4 TarotCard
- Componente de carta individual com dois estados:
  - **Face down**: verso do baralho, borda arredondada, sombra
  - **Face up**: frente da carta com imagem, nome, numero/naipe, indicador de orientacao
- Animacao de revelacao: flip 3D (rotateY 0 -> 180deg) com 600ms, easing ease-out
- Variante reversa: rotacao adicional de 180deg no eixo Z
- Hover: elevacao (scale 1.05, shadow maior)
- Clicavel: abre painel de detalhes
- Variantes de tamanho: small (80x140), medium (120x210), large (180x315)

### 1.5 CardDetailPanel
- Drawer lateral (direita) que slide-in ao clicar em uma carta
- Exibe todos os detalhes da carta (nome, numero, naipe, orientacao, significados)
- Tabs: "Geral" / "No Contexto" / "Conselho"
- Botao de fechar (X) e swipe-to-close no mobile
- Dimmer no fundo ao abrir
- Scroll interno se conteudo exceder a tela

### 1.6 ReadingSession
- Componente wrapper que gerencia o ciclo de vida completo da leitura
- Barra superior com: nome do espalhamento, timer, contagem de cartas, botoes de acao
- Botoes: "Salvar", "Compartilhar", "Pedir Interpretacao IA", "Reembaralhar"
- Auto-save silencioso a cada 30s
- Recovery: ao recarregar a pagina, restaura o estado da sessao ativa

### 1.7 ReadingTimer
- Timer no formato MM:SS no canto superior direito
- Inicia automaticamente na fase de sorteio
- Pausa quando o painel de detalhes esta aberto
- Exibido no salvamento final ("Tempo de leitura: 5min 23s")

### 1.8 ShareModal
- Modal com opcoes de compartilhamento:
  - Copiar link (clipboard API)
  - Web Share API (mobile)
  - Download como imagem (PNG)
  - Botoes de redes sociais (WhatsApp, Instagram, Twitter)
- Preview da imagem de compartilhamento
- Toggle "Tornar publica esta tiragem"

### 1.9 DailyLimitBanner
- Banner sutil no topo da pagina quando o usuario Free esta perto do limite
- Formato: "Voce fez 2 de 3 tiragens hoje. Considere o plano Plus para tiragens ilimitadas."
- Cor de alerta amarela quando restar apenas 1 tiragem
- Cor vermelha e CTA bloqueante quando o limite e atingido

---

## 2. Estrutura de Dados das Cartas

### 2.1 Dados do Baralho RWS

```typescript
interface Deck {
  id: 'rws' | 'thoth' | 'lenormand';
  name: string;
  description: string;
  author: string;
  year: number;
  cardCount: number;
  hasReversals: boolean;
  coverImageUrl: string;
  cardBackImageUrl: string;
}

interface TarotCard {
  id: string;           // ex: "rws-major-0" ou "rws-minor-wands-01"
  deckId: 'rws' | 'thoth';
  type: 'major' | 'minor';
  number: number;       // 0-21 para major, 1-14 para minor
  name: string;         // "O Louco", "As de Copas"
  suit?: 'wands' | 'cups' | 'swords' | 'pentacles';
  suitName?: string;    // "Paus", "Copas", "Espadas", "Ouros"
  keywords: string[];   // ["novidade", "inicio", "liberdade"]
  meaningUp: string;    // 2-3 paragrafos
  meaningReversed: string;
  advice: string;
  imageUrl: string;
  element?: string;     // "Fogo", "Agua", "Ar", "Terra"
  astrology?: string;   // "Marte", "Venus", etc.
  numerology?: number;  // reducao numerologica
}
```

### 2.2 Dados do Baralho Lenormand

```typescript
interface LenormandCard {
  id: string;           // ex: "lenormand-01"
  number: number;       // 1-36
  name: string;         // "Cavaleiro", "Ancora"
  keywords: string[];
  meaningGeneral: string;
  meaningLove: string;
  meaningWork: string;
  meaningHealth: string;
  imageUrl: string;
  category: string;     // "pessoas", "animais", "objetos", "natureza", "abstrato"
}
```

### 2.3 Dados do Espalhamento

```typescript
interface Spread {
  id: string;
  name: string;
  description: string;
  deckType: 'tarot' | 'lenormand';
  cardCount: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number;  // em minutos
  positions: SpreadPosition[];
  layout: 'linear' | 'cross' | 'grid' | 'diamond' | 'custom';
}

interface SpreadPosition {
  id: string;
  name: string;          // "Passado", "Presente", "Futuro"
  description: string;   // "Representa influencias do passado"
  gridX?: number;        // posicao no grid (0-based)
  gridY?: number;
}
```

---

## 3. Geradores de Espalhamento

### 3.1 Algoritmo de Sorteio

```typescript
function drawCards(deck: Deck, count: number, userId: string): DrawnCard[] {
  // 1. Obter todas as cartas do baralho
  const allCards = getCardsByDeck(deck.id);

  // 2. Gerar seed criptografico
  const seed = generateSeed(userId, deck.id, Date.now());
  const rng = createSeededRNG(seed); // CSPRNG-based

  // 3. Embaralhar (Fisher-Yates)
  const shuffled = [...allCards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 4. Selecionar as primeiras N cartas
  const selected = shuffled.slice(0, count);

  // 5. Determinar orientacao (se aplicavel)
  return selected.map((card, index) => ({
    card,
    isReversed: deck.hasReversals ? rng() < 0.3 : false, // 30% de chance de reversa
    position: index,
  }));
}
```

### 3.2 Layouts de Espalhamento

**Tres Cartas (linear):**
```
  [  Carta 1  ] [  Carta 2  ] [  Carta 3  ]
   Passado       Presente       Futuro
```

**Cruz Celta (cross + staff):**
```
                [4]
                 |
         [2] - [1] - [5]
                 |
                [3]
                 |
                [6]

   [10] [9] [8] [7]
```

**Sim/Nao (single):**
```
        [ 1 ]
       Resposta
```

**Lenormand 9 Cartas (grid 3x3):**
```
  [1] [2] [3]
  [4] [5] [6]
  [7] [8] [9]
```

---

## 4. Fluxo de Dados

```
    FLUXO DE TIRAGEM
    ================

    [1] Usuario seleciona baralho (DeckSelector)
         |
         v
    [2] Usuario seleciona espalhamento (SpreadSelector)
         |
         v
    [3] Estado: { deck, spread, phase: 'ready' }
         |
         v
    [4] Usuario clica "Embaralhar e Revelar"
         |
         v
    [5] drawCards(deck, spread.cardCount, userId)
         |  -> CSPRNG, Fisher-Yates, sem reposicao
         v
    [6] Estado: { cards: [...], phase: 'revealing', seed: '...' }
         |
         v
    [7] Animacao sequencial de revelacao
         |  -> Cada carta com delay de 300ms
         |  -> Framer Motion: rotateY flip
         v
    [8] Estado: { phase: 'reading' }
         |  Timer inicia contagem
         v
    [9] Usuario clica em carta -> CardDetailPanel abre
         |  -> Carrega significado + contexto da posicao
         v
    [10] Usuario clica "Salvar"
         |
         v
    [11] POST /api/v1/readings
         |  Body: { deckId, spreadId, cards, title, notes, seed, duration }
         v
    [12] Salvo com sucesso -> redireciona para "Minhas Tiragens"
```

---

## 5. API Endpoints

### GET /api/v1/decks
**Descricao**: Lista todos os baralhos disponiveis.
**Response 200**: `{ decks: Deck[] }`

### GET /api/v1/decks/:deckId/cards
**Descricao**: Retorna todas as cartas de um baralho.
**Response 200**: `{ cards: TarotCard[] | LenormandCard[] }`

### GET /api/v1/spreads?deckType=tarot|lenormand
**Descricao**: Lista espalhamentos disponiveis para o tipo de baralho.
**Response 200**: `{ spreads: Spread[] }`

### POST /api/v1/readings
**Descricao**: Salva uma tiragem completa.
**Headers**: `Authorization: Bearer <token>`
**Body**:
```json
{
  "deckId": "rws",
  "spreadId": "three-card",
  "cards": [
    { "cardId": "rws-major-0", "positionIndex": 0, "isReversed": false },
    { "cardId": "rws-major-14", "positionIndex": 1, "isReversed": true },
    { "cardId": "rws-minor-cups-10", "positionIndex": 2, "isReversed": false }
  ],
  "title": "Tiragem do meu aniversario",
  "notes": "Me sinto em transicao...",
  "seed": "a1b2c3...",
  "duration": 323,
  "isPublic": false
}
```
**Response 201**: `{ reading: { id, ... } }`
**Response 429**: `{ error: "DAILY_LIMIT_REACHED", remaining: 0 }`

### GET /api/v1/readings?userId=me&page=1&limit=20
**Descricao**: Lista tiragens do usuario logado.
**Response 200**: `{ readings: Reading[], pagination: { page, limit, total } }`

### GET /api/v1/readings/:id
**Descricao**: Retorna uma tiragem especifica (publica ou do proprio usuario).
**Response 200**: `{ reading: Reading }`
**Response 404**: `{ error: "READING_NOT_FOUND" }`

### GET /api/v1/readings/:id/og-image
**Descricao**: Gera e retorna imagem OG (1200x630) da tiragem.
**Response 200**: `image/png`

### GET /api/v1/readings/daily-count
**Descricao**: Retorna contagem de tiragens do dia.
**Response 200**: `{ count: 2, limit: 3, remaining: 1 }`

---

## 6. Database Schema

```prisma
model Reading {
  id           String   @id @default(cuid())
  userId       String
  deckId       String   // "rws" | "thoth" | "lenormand"
  spreadId     String   // "three-card", "celtic-cross", etc.
  title        String?
  notes        String?
  seed         String
  duration     Int      // em segundos
  isPublic     Boolean  @default(false)
  createdAt    DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cards        ReadingCard[]

  @@index([userId, createdAt])
  @@map("readings")
}

model ReadingCard {
  id           String   @id @default(cuid())
  readingId    String
  cardId       String   // ex: "rws-major-0"
  positionIndex Int
  isReversed   Boolean  @default(false)

  reading      Reading  @relation(fields: [readingId], references: [id], onDelete: Cascade)

  @@map("reading_cards")
}
```

---

## 7. Estado (Zustand)

### ReadingStore

```typescript
interface ReadingState {
  // Sessao atual
  phase: 'idle' | 'selecting-deck' | 'selecting-spread' | 'ready' | 'shuffling' | 'revealing' | 'reading' | 'saving';
  selectedDeck: Deck | null;
  selectedSpread: Spread | null;
  drawnCards: DrawnCard[];
  seed: string | null;
  timerSeconds: number;
  isTimerRunning: boolean;

  // Detalhe
  selectedCardIndex: number | null;
  isDetailOpen: boolean;

  // Acoes
  selectDeck: (deck: Deck) => void;
  selectSpread: (spread: Spread) => void;
  startReading: () => void;
  selectCard: (index: number) => void;
  closeDetail: () => void;
  reshuffle: () => void;
  saveReading: (data: SaveReadingData) => Promise<void>;
  reset: () => void;

  // Timer
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
}
```

**Persistencia**: O estado da sessao ativa (deck, spread, drawnCards, seed, timerSeconds) e persistido em `sessionStorage` para recuperacao apos reload. A persistencia e limpa ao salvar ou ao navegar para fora da pagina de tiragem.

---

## 8. Animacoes (Framer Motion)

### 8.1 Revelacao de Carta (Flip)
```typescript
const cardVariants = {
  faceDown: { rotateY: 0 },
  faceUp: {
    rotateY: 180,
    transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] }
  },
};

const cardInnerVariants = {
  faceDown: { rotateY: 0 },
  faceUp: { rotateY: 0 }, // contrarrotacao para manter texto legivel
};
```

### 8.2 Stagger de Revelacao
```typescript
const containerVariants = {
  hidden: {},
  reveal: {
    transition: {
      staggerChildren: 0.3, // 300ms entre cada carta
    },
  },
};
```

### 8.3 Requisitos de Performance
- Usar `transform` e `opacity` exclusivamente (GPU-accelerated)
- Adicionar `will-change: transform` nas cartas durante animacao
- Remover `will-change` apos a animacao
- Usar `layoutAnimation` do Framer Motion para transicoes de layout
- Testar em Chrome DevTools Performance tab: nenhum frame > 16.6ms

---

## 9. Rotas da Aplicacao

| Rota | Componente | Protegida | Descricao |
|---|---|---|---|
| `/tirar` | DeckSelector + SpreadSelector | Sim | Inicio do fluxo de tiragem |
| `/tirar/sessao` | ReadingSession | Sim | Mesa de tiragem e leitura |
| `/tiragem/:id` | SharedReadingPage | Nao | Tiragem compartilhada (publica) |
| `/minhas-tiragens` | MyReadingsPage | Sim | Historico de tiragens do usuario |
