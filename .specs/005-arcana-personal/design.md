# SPEC-005: Arcano Pessoal -- Design Tecnico

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## 1. Algoritmo de Reducao Pitagorica

### 1.1 Funcao de Reducao

```typescript
/**
 * Reduz um numero a um unico digito ou numero mestre (11, 22, 33).
 * @param num Numero a ser reduzido
 * @returns Numero reduzido (1-9, 11, 22, 33) ou 0 para o caso especial do Louco
 */
function reduceToArcana(num: number): number {
  const MASTER_NUMBERS = [11, 22, 33];

  while (num > 9 && !MASTER_NUMBERS.includes(num)) {
    const digits = String(num).split('');
    num = digits.reduce((sum, d) => sum + parseInt(d, 10), 0);
  }

  return num;
}
```

### 1.2 Calculo pela Data

```typescript
function calculateArcanaByDate(day: number, month: number, year: number): number {
  const dayReduced = reduceToArcana(day);
  const monthReduced = reduceToArcana(month);
  const yearReduced = reduceToArcana(reduceToArcana(year));
  const total = dayReduced + monthReduced + yearReduced;
  return reduceToArcana(total);
}
```

### 1.3 Calculo pelo Nome

```typescript
const PYTHAGOREAN_TABLE: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
  J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
  S: 1, T: 2, U: 3, V: 4, W: 5, X: 6, Y: 7, Z: 8,
};

function calculateArcanaByName(fullName: string): number {
  // 1. Remover acentos
  const normalized = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacriticos

  // 2. Manter apenas letras, converter para maiusculas
  const lettersOnly = normalized.toUpperCase().replace(/[^A-Z]/g, '');

  // 3. Somar valores pela tabela
  const sum = lettersOnly
    .split('')
    .reduce((total, letter) => total + (PYTHAGOREAN_TABLE[letter] || 0), 0);

  // 4. Reduzir a arcano
  return reduceToArcana(sum);
}
```

### 1.4 Calculo Combinado

```typescriptn
function calculatePersonalArcana(
  day: number,
  month: number,
  year: number,
  fullName: string
): PersonalArcanaResult {
  const dateArcana = calculateArcanaByDate(day, month, year);
  const nameArcana = calculateArcanaByName(fullName);
  const combined = reduceToArcana(dateArcana + nameArcana);

  return {
    dateArcana,
    dateArcanaName: ARCANA_MAP[dateArcana].name,
    nameArcana,
    nameArcanaName: ARCANA_MAP[nameArcana].name,
    combinedArcana: combined,
    combinedArcanaName: ARCANA_MAP[combined].name,
    isMasterNumber: [11, 22, 33].includes(combined),
  };
}
```

---

## 2. Tabela Pitagorica Completa

| Letra | Valor | Letra | Valor | Letra | Valor |
|-------|-------|-------|-------|-------|-------|
| A | 1 | J | 1 | S | 1 |
| B | 2 | K | 2 | T | 2 |
| C | 3 | L | 3 | U | 3 |
| D | 4 | M | 4 | V | 4 |
| E | 5 | N | 5 | W | 5 |
| F | 6 | O | 6 | X | 6 |
| G | 7 | P | 7 | Y | 7 |
| H | 8 | Q | 8 | Z | 8 |
| I | 9 | R | 9 | | |

**Observacao:** O alfabeto portugues possui 26 letras. A ultima letra Z recebe o valor 8, nao 9. Isso ocorre porque a tabela pitagorica foi projetada para 9 posicoes por coluna, e o alfabeto latino (sem K, W, Y originais) possuia 23 letras. No sistema adaptado para portugues, Z=8 e nao ha letra com valor 9 na terceira fileira.

---

## 3. Mapeamento Arcano (0-21)

```typescript
const ARCANA_MAP: Record<number, ArcanaData> = {
  0: {
    name: 'O Louco',
    keywords: ['novo comeco', 'liberdade', 'inocencia', 'risco'],
    element: 'Ar',
    astrology: 'Urano',
    description: 'O Louco representa o inicio de uma jornada espiritual...',
    advice: 'Abrace o desconhecido com coragem e abertura.',
  },
  1: {
    name: 'O Mago',
    keywords: ['criatividade', 'poder', 'manifestacao', 'habilidade'],
    element: 'Ar',
    astrology: 'Mercurio',
    description: 'O Mago simboliza o poder da mente...',
    advice: 'Voce possui todas as ferramentas necessarias. Aja com confianca.',
  },
  2: {
    name: 'A Sacerdotisa',
    keywords: ['intuicao', 'sabedoria interior', 'misterio', 'subconsciente'],
    element: 'Agua',
    astrology: 'Lua',
    description: 'A Sacerdotisa e a guardia dos segredos...',
    advice: 'Confie na sua intuicao. As respostas estao dentro de voce.',
  },
  3: {
    name: 'A Imperatriz',
    keywords: ['fertilidade', 'abundancia', 'natureza', 'maternidade'],
    element: 'Terra',
    astrology: 'Venus',
    description: 'A Imperatriz representa a forca criativa da natureza...',
    advice: 'Cultive suas ideias com paciencia e cuidado.',
  },
  4: {
    name: 'O Imperador',
    keywords: ['autoridade', 'estrutura', 'estabilidade', 'lideranca'],
    element: 'Fogo',
    astrology: 'Aries',
    description: 'O Imperador personifica a ordem e o poder...',
    advice: 'Estruture sua vida com disciplina e determinacao.',
  },
  5: {
    name: 'O Hierofante',
    keywords: ['tradicao', 'espiritualidade', 'ensino', 'conformismo'],
    element: 'Terra',
    astrology: 'Touro',
    description: 'O Hierofante e o guia espiritual...',
    advice: 'Busque conhecimento em tradicoes e mentores.',
  },
  6: {
    name: 'O Enamorado',
    keywords: ['escolha', 'amor', 'harmonia', 'decisoes'],
    element: 'Ar',
    astrology: 'Gemeos',
    description: 'O Enamorado simboliza as escolhas do coracao...',
    advice: 'Ouca seu coracao, mas equilibre com a razao.',
  },
  7: {
    name: 'O Carro',
    keywords: ['determinacao', 'vitoria', 'controle', 'viagem'],
    element: 'Agua',
    astrology: 'Cancer',
    description: 'O Carro representa o triunfo da vontade...',
    advice: 'Mantenha o foco e avance com determinacao.',
  },
  8: {
    name: 'A Forca',
    keywords: ['coragem', 'paciencia', 'dominio interior', 'compaixao'],
    element: 'Fogo',
    astrology: 'Leao',
    description: 'A Forca mostra que a verdadeira forca e interior...',
    advice: 'A domine suas impulsos com suavidade, nao com forca bruta.',
  },
  9: {
    name: 'O Eremita',
    keywords: ['sabedoria', 'introspecao', 'solidao', 'orientacao'],
    element: 'Terra',
    astrology: 'Virgem',
    description: 'O Eremita representa a busca pela verdade interior...',
    advice: 'Tire um tempo para reflexao. A solidao pode ser uma aliada.',
  },
  10: {
    name: 'A Roda da Fortuna',
    keywords: ['ciclos', 'mudanca', 'destino', 'virada'],
    element: 'Fogo',
    astrology: 'Jupiter',
    description: 'A Roda da Fortuna lembra que tudo e ciclico...',
    advice: 'Aceite as mudancas. O que sobe tambem desce, e vice-versa.',
  },
  11: {
    name: 'A Justica',
    keywords: ['equilibrio', 'verdade', 'lei', 'causa e efeito'],
    element: 'Ar',
    astrology: 'Libra',
    description: 'A Justica representa o equilibrio cosmicoo...',
    advice: 'Aja com justica e honestidade. A colheita e proporcional a semeadura.',
  },
  12: {
    name: 'O Enforcado',
    keywords: ['sacrificio', 'nova perspectiva', 'espera', 'rendicao'],
    element: 'Agua',
    astrology: 'Netuno',
    description: 'O Enforcado sugere uma pausa para reflexao...',
    advice: 'Mude sua perspectiva. O que parece sacrificio pode ser libertacao.',
  },
  13: {
    name: 'A Morte',
    keywords: ['transformacao', 'fim', 'transicao', 'renascimento'],
    element: 'Agua',
    astrology: 'Escorpiao',
    description: 'A Morte simboliza o fim de um ciclo...',
    advice: 'Deixe ir o que nao serve mais. A transformacao e necessaria.',
  },
  14: {
    name: 'A Temperanca',
    keywords: ['equilibrio', 'paciencia', 'harmonia', 'moderacao'],
    element: 'Fogo',
    astrology: 'Sagitario',
    description: 'A Temperanca fala de equilibrar opostos...',
    advice: 'Busque o meio-termo. A paciencia sera sua maior aliada.',
  },
  15: {
    name: 'O Diabo',
    keywords: ['tentacao', 'materialismo', 'sombra', 'apego'],
    element: 'Terra',
    astrology: 'Capricornio',
    description: 'O Diabo representa as correntes que nos prenderem...',
    advice: 'Liberte-se dos apegos materiais e emocionais.',
  },
  16: {
    name: 'A Torre',
    keywords: ['ruptura', 'revelacao', 'mudanca drastica', 'despertar'],
    element: 'Fogo',
    astrology: 'Marte',
    description: 'A Torre anuncia uma mudanca repentina...',
    advice: 'Apos a tempestade vem a calmaria. Confie no processo.',
  },
  17: {
    name: 'A Estrela',
    keywords: ['esperanca', 'inspiracao', 'renovacao', 'cura'],
    element: 'Ar',
    astrology: 'Aquario',
    description: 'A Estrela traz esperanca e renovacao...',
    advice: 'Mantenha a fe. Apos a escuridao, sempre ha uma estrela.',
  },
  18: {
    name: 'A Lua',
    keywords: ['ilusao', 'inconsciente', 'medo', 'intuicao'],
    element: 'Agua',
    astrology: 'Peixes',
    description: 'A Lua ilumina o mundo dos sonhos e do inconsciente...',
    advice: 'Preste atencao aos seus sonhos e intuicoes.',
  },
  19: {
    name: 'O Sol',
    keywords: ['sucesso', 'vitalidade', 'alegria', 'clareza'],
    element: 'Fogo',
    astrology: 'Sol',
    description: 'O Sol representa a plenitude e o sucesso...',
    advice: 'Aproveite a energia positiva. O sucesso esta ao seu alcance.',
  },
  20: {
    name: 'O Julgamento',
    keywords: ['renascimento', 'avaliacao', 'chamado', 'despertar'],
    element: 'Fogo',
    astrology: 'Plutao',
    description: 'O Julgamento chama para uma avaliacao profunda...',
    advice: 'Ouca o chamado interior. E hora de se libertar do passado.',
  },
  21: {
    name: 'O Mundo',
    keywords: ['conclusao', 'integracao', 'realizacao', 'totalidade'],
    element: 'Saturno',
    astrology: 'Saturno',
    description: 'O Mundo representa a conclusao bem-sucedida...',
    advice: 'Celebre suas conquistas. Um ciclo se fecha, outro se abre.',
  },
};
```

---

## 4. Componentes de Interface

### 4.1 ArcanaCalculator
- Formulario com campos: data de nascimento (datepicker), nome completo (input text)
- Botao "Calcular meu Arcano"
- Calculo instantaneo (client-side, sem loading)
- Resultados exibidos em 3 cards: "Arcano da Data", "Arcano do Nome", "Arcano Combinado"
- Cada card com: numero, nome do arcano, imagem, palavras-chave
- Animacao de revelacao com Framer Motion (stagger 200ms)

### 4.2 ArcanaDetailCard
- Card expandido com imagem do arcano em destaque
- Nome em tipografia grande
- Numero com indicador de numero mestre (se aplicavel)
- Elemento e signo astrologico
- Palavras-chave como tags/chips
- Descricao completa (2 paragrafos)
- Conselho pratico em destaque

### 4.3 ArcanaAIInterpretation
- Botao "Solicitar Interpretacao Personalizada"
- Reutiliza o componente StreamingInterpretation (SPEC-004)
- Contexto enriquecido com os 3 arcanos calculados + signo solar

---

## 5. Fluxo de Calculo

```
    FLUXO DE CALCULO DO ARCANO PESSOAL
    ====================================

    [1] Usuario preenche data de nascimento e nome
         |
         v
    [2] Validacao client-side (Zod)
         |  - Data valida (1900-2100)
         |  - Nome nao vazio, apenas letras e espacos
         v
    [3] Calculo client-side (sem chamada ao servidor)
         |
         +-> [3a] calculateArcanaByDate(d, m, y)
         |         |  reduce(d) + reduce(m) + reduce(reduce(y))
         |         |  -> reduce(total)
         |         v
         |     numero (1-9, 11, 22, 33)
         |
         +-> [3b] calculateArcanaByName(name)
         |         |  normalizar -> tabela pitagorica -> soma -> reduce
         |         v
         |     numero (1-9, 11, 22, 33)
         |
         +-> [3c] reduce(dateResult + nameResult)
         |         v
         |     Arcano Final
         v
    [4] Exibir 3 resultados com animacao
         |
         v
    [5] (Opcional) Solicitar interpretacao IA
         |
         v
    [6] POST /api/v1/ai/arcana-interpret (streaming)
```

---

## 6. API Endpoints

### POST /api/v1/ai/arcana-interpret
**Descricao**: Gera interpretacao IA do Arcano Pessoal (streaming).
**Body**: `{ dateArcana, nameArcana, combinedArcana, sunSign?, birthDate, fullName }`
**Response 200**: `text/event-stream` com tokens

### GET /api/v1/arcana/calculate
**Descricao**: Calcula o Arcano Pessoal (alternativa server-side). Util para validacao.
**Query**: `?day=15&month=4&year=1992&name=Maria%20Silva`
**Response 200**: `{ dateArcana, nameArcana, combinedArcana }`

---

## 7. Rotas da Aplicacao

| Rota | Componente | Protegida | Descricao |
|---|---|---|---|
| `/meu-arcano` | ArcanaPage | Sim | Calculo e exibicao do arcano pessoal |
| `/meu-arcano/:arcana` | ArcanaDetailPage | Nao | Pagina de detalhe de qualquer arcano (0-21) |

---

## 8. Estado

O calculo e puramente client-side. O resultado e salvo no perfil do usuario (campo `personalArcana` na tabela Profile) ao preencher a data de nascimento e nome pela primeira vez. Nao e necessario Zustand dedicado -- o estado e gerenciado por estado local do componente React.