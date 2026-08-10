# SPEC-006: Horoscopos -- Design Tecnico

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## 1. Algoritmos de Calculo

### 1.1 Horoscopo Ocidental

```typescript
function getWesternSign(day: number, month: number): WesternSign {
  const SIGN_RANGES = [
    { sign: 'capricornio', startMonth: 12, startDay: 22, endMonth: 1, endDay: 19 },
    { sign: 'aquario',     startMonth: 1,  startDay: 20, endMonth: 2, endDay: 18 },
    { sign: 'peixes',      startMonth: 2,  startDay: 19, endMonth: 3, endDay: 20 },
    { sign: 'aries',       startMonth: 3,  startDay: 21, endMonth: 4, endDay: 19 },
    { sign: 'touro',       startMonth: 4,  startDay: 20, endMonth: 5, endDay: 20 },
    { sign: 'gemeos',      startMonth: 5,  startDay: 21, endMonth: 6, endDay: 20 },
    { sign: 'cancer',      startMonth: 6,  startDay: 21, endMonth: 7, endDay: 22 },
    { sign: 'leao',        startMonth: 7,  startDay: 23, endMonth: 8, endDay: 22 },
    { sign: 'virgem',      startMonth: 8,  startDay: 23, endMonth: 9, endDay: 22 },
    { sign: 'libra',       startMonth: 9,  startDay: 23, endMonth: 10, endDay: 22 },
    { sign: 'escorpiao',   startMonth: 10, startDay: 23, endMonth: 11, endDay: 21 },
    { sign: 'sagitario',   startMonth: 11, startDay: 22, endMonth: 12, endDay: 21 },
  ];

  for (const range of SIGN_RANGES) {
    if (range.startMonth === range.endMonth) {
      if (month === range.startMonth && day >= range.startDay && day <= range.endDay) {
        return range.sign;
      }
    } else if (range.startMonth > range.endMonth) {
      // Capricornio (dez -> jan)
      if ((month === range.startMonth && day >= range.startDay) ||
          (month === range.endMonth && day <= range.endDay)) {
        return range.sign;
      }
    } else {
      if ((month === range.startMonth && day >= range.startDay) ||
          (month === range.endMonth && day <= range.endDay) ||
          (month > range.startMonth && month < range.endMonth)) {
        return range.sign;
      }
    }
  }
  throw new Error('Data invalida para calculo de signo');
}
```

### 1.2 Horoscopo Chines

```typescript
function getChineseZodiac(year: number, month: number, day: number): ChineseZodiac {
  // Tabela de Ano Novo Chines (datas aproximadas)
  const CHINESE_NEW_YEAR_DATES: Record<number, { month: number; day: number }> = {
    1980: { month: 2, day: 16 },
    1981: { month: 2, day: 5 },
    1982: { month: 1, day: 25 },
    // ... preencher de 1980 a 2035
    2025: { month: 1, day: 29 },
  };

  const newYear = CHINESE_NEW_YEAR_DATES[year];
  // Se a pessoa nasceu antes do Ano Novo Chines, usar o ano anterior
  const effectiveYear = (month < newYear.month || (month === newYear.month && day < newYear.day))
    ? year - 1
    : year;

  const animals = ['macaco', 'galo', 'cao', 'porco', 'rato', 'boi', 'tigre',
                    'coelho', 'dragao', 'serpente', 'cavalo', 'cabra'];
  const animalIndex = effectiveYear % 12;

  const elements = ['metal', 'agua', 'madeira', 'fogo', 'terra'];
  const elementIndex = (effectiveYear - 4) % 5;

  return {
    animal: animals[animalIndex],
    element: elements[elementIndex],
    year: effectiveYear,
  };
}
```

### 1.3 Horoscopo Maia (Calendario Tzolkin)

```typescriptn
/**
 * Converte data gregoriana para Contagem Longa Maia.
 * Baseada na correlacao GMT (Goodman-Martinez-Thompson).
 * Data zero: 11 de agosto de 3114 a.C. (Juliano) = 6 de setembro de 3114 a.C. (Gregoriano)
 * Correlacao: JDN 584283 para o dia 0.0.0.0.0 da Contagem Longa.
 */
function gregorianToMayanLongCount(year: number, month: number, day: number): MayanDate {
  // 1. Converter para Julian Day Number (JDN)
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y
              + Math.floor(y / 4) - Math.floor(y / 100)
              + Math.floor(y / 400) - 32045;

  // 2. Calcular dias desde o inicio da Contagem Longa
  const daysSinceCreation = jdn - 584283;

  // 3. Converter para unidades da Contagem Longa
  const baktun = Math.floor(daysSinceCreation / 144000) % 20;
  const katun = Math.floor((daysSinceCreation % 144000) / 7200) % 20;
  const tun = Math.floor((daysSinceCreation % 7200) / 360) % 20;
  const uinal = Math.floor((daysSinceCreation % 360) / 20) % 18;
  const kin = daysSinceCreation % 20;

  // 4. Converter para Tzolkin (260 dias)
  const tzolkinNumber = (daysSinceCreation + 4) % 13 + 1;  // Tom (1-13)
  const tzolkinSeal = (daysSinceCreation + 19) % 20;       // Selo (0-19)

  return {
    longCount: { baktun, katun, tun, uinal, kin },
    tzolkinTone: tzolkinNumber,
    tzolkinSeal: tzolkinSeal,
    kinNumber: ((tzolkinNumber - 1) * 20) + tzolkinSeal + 1,
  };
}
```

---

## 2. Estruturas de Dados

### 2.1 Horoscopo Ocidental

```typescript
interface WesternSign {
  id: string;             // 'aries', 'touro', etc.
  name: string;           // 'Aries', 'Touro', etc.
  emoji: string;          // codigo unicode (ex: U+2648)
  element: string;        // 'Fogo', 'Terra', 'Ar', 'Agua'
  ruler: string;          // 'Marte', 'Venus', etc.
  startDate: string;      // '21/03'
  endDate: string;        // '19/04'
  keywords: string[];
}

interface WesternHoroscope {
  signId: string;
  period: 'daily' | 'weekly' | 'monthly';
  date: string;           // '2025-01-15' ou '2025-W03' ou '2025-01'
  content: {
    general: string;
    love?: string;
    career?: string;
    health?: string;
  };
  luckyNumber?: number;
  luckyColor?: string;
  mood: string;
  compatibility: string;
}
```

### 2.2 Horoscopo Chines

```typescript
interface ChineseAnimal {
  id: string;             // 'rato', 'boi', etc.
  name: string;
  characteristics: string[];
  yinYang: 'yin' | 'yang';
  fixedElement: string;   // elemento intrinseco do animal
}

interface ChineseZodiac {
  animal: string;
  element: string;        // 'madeira', 'fogo', 'terra', 'metal', 'agua'
  year: number;
}

interface ChineseHoroscope {
  animalId: string;
  element: string;
  period: 'daily' | 'weekly' | 'monthly';
  date: string;
  content: string;
}
```

### 2.3 Horoscopo Maia

```typescript
interface MayanSeal {
  id: number;             // 0-19
  name: string;           // 'Dragao Vermelho'
  meaning: string;
  direction: string;
  color: string;
}

interface MayanTone {
  id: number;             // 1-13
  name: string;           // 'Magnetico'
  keyword: string;
  action: string;
  power: string;
}

interface MayanDate {
  longCount: {
    baktun: number;
    katun: number;
    tun: number;
    uinal: number;
    kin: number;
  };
  tzolkinTone: number;    // 1-13
  tzolkinSeal: number;    // 0-19
  kinNumber: number;      // 1-260
}

interface MayanHoroscope {
  kinNumber: number;
  sealId: number;
  toneId: number;
  period: 'daily' | 'weekly';
  date: string;
  content: string;
}
```

---

## 3. Componentes de Interface

### 3.1 HoroscopeLanding
- Pagina principal `/horoscopos`
- Tabs para os 3 sistemas: Ocidental, Chines, Maia
- Exibicao do horoscopo do usuario logado (baseado na data de nascimento)
- Se nao logado: seletor de signo/animal/kin
- Horoscopo do dia em destaque
- Links para semanal e mensal

### 3.2 WesternHoroscopeCard
- Card com icone do signo (Unicode)
- Nome do signo
- Texto do horoscopo
- Secoes colapsaveis: Amor, Carreira, Saude
- Numero da sorte, cor do sorte, compatibilidade
- Botoes para compartilhar

### 3.3 ChineseHoroscopeCard
- Card com imagem/icone do animal
- Nome do animal + elemento (ex.: "Cavalo de Metal")
- Texto do horoscopo
- Caracteristicas do animal em chips

### 3.4 MayanHoroscopeCard
- Card visualmente tematico (cores dos selos: vermelho, branco, azul, amarelo)
- Selo + Tom em destaque (ex.: "Dragao Vermelho Magnetico - Tom 1")
- Texto do horoscopo
- Elementos graficos da cultura maia

### 3.5 HoroscopeHistory
- Lista paginada de horoscopos consultados
- Filtros: tipo (ocidental/chines/maia), periodo, data
- Cada item: tipo, signo/animal/kin, data da consulta, link para detalhes

---

## 4. API Endpoints

### GET /api/v1/horoscopes/western
**Query**: `?sign=aries&period=daily&date=2025-01-15`
**Response 200**: `{ horoscope: WesternHoroscope }`

### GET /api/v1/horoscopes/chinese
**Query**: `?animal=dragao&element=madeira&period=daily&date=2025-01-15`
**Response 200**: `{ horoscope: ChineseHoroscope }`

### GET /api/v1/horoscopes/maya
**Query**: `?kinNumber=47&period=daily&date=2025-01-15`
**Response 200**: `{ horoscope: MayanHoroscope }`

### GET /api/v1/horoscopes/my-horoscope
**Descricao**: Retorna todos os horoscopos do usuario logado para o periodo atual.
**Response 200**: `{ western: WesternHoroscope, chinese: ChineseHoroscope, mayan: MayanHoroscope }`

### POST /api/v1/ai/horoscope-interpret
**Descricao**: Gera interpretacao IA detalhada.
**Body**: `{ type, signId, period, date }`
**Response 200**: `text/event-stream`

### GET /api/v1/horoscopes/history?page=1&limit=20
**Response 200**: `{ items: HoroscopeLog[], pagination: {...} }`

---

## 5. Database Schema

```prisma
model HoroscopeContent {
  id        String   @id @default(cuid())
  type      String   // 'western' | 'chinese' | 'maya'
  signId    String   // 'aries', 'rato', seal number, etc.
  element   String?  // 'madeira', 'fogo' (chines)
  period    String   // 'daily' | 'weekly' | 'monthly'
  date      String   // '2025-01-15', '2025-W03', '2025-01'
  content   Json     // conteudo estruturado
  createdAt DateTime @default(now())

  @@unique([type, signId, element, period, date])
  @@map("horoscope_contents")
}

model HoroscopeLog {
  id        String   @id @default(cuid())
  userId    String
  type      String
  signId    String
  element   String?
  period    String
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("horoscope_logs")
}

model HoroscopeNotification {
  id        String   @id @default(cuid())
  userId    String   @unique
  westernEnabled  Boolean @default(true)
  chineseEnabled  Boolean @default(false)
  mayaEnabled     Boolean @default(false)
  hour      Int      @default(7)  // 0-23, BRT

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("horoscope_notifications")
}
```

---

## 6. Cron Job de Geracao Diaria

```
CRON: 0 4 * * * (todo dia as 04:00 BRT)

1. Determinar a data de hoje e amanha
2. Para cada tipo (western, chinese, maya):
   a. Para cada signo/animal/kin:
      - Verificar se ja existe conteudo para amanha
      - Se nao, gerar via IA (batch, sem streaming)
      - Salvar no banco
3. Log do resultado (quantidade gerada, erros)
```

---

## 7. Rotas da Aplicacao

| Rota | Componente | Protegida | Descricao |
|---|---|---|---|
| `/horoscopos` | HoroscopeLanding | Nao | Pagina principal de horoscopos |
| `/horoscopos/ocidental` | WesternHoroscopePage | Nao | Horoscopo ocidental detalhado |
| `/horoscopos/chines` | ChineseHoroscopePage | Nao | Horoscopo chines detalhado |
| `/horoscopos/maia` | MayanHoroscopePage | Nao | Horoscopo maia detalhado |
| `/horoscopos/historico` | HoroscopeHistory | Sim | Historico de consultas |
