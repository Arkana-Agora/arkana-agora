# Tarot — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Tarot | **Versão**: MVP

---

## Descrição

O módulo de Tarot é o recurso central do **Arkana Agora**, oferecendo uma experiência completa de leitura de cartas com o baralho padrão Rider-Waite-Smith (78 cartas: 22 Arcanos Maiores + 56 Arcanos Menores). O usuário pode selecionar entre diferentes baralhos disponíveis, escolher o tipo de tiragem e realizar a leitura com mecânicas de sorteio variadas — aleatório ponderado, baseado em data ou puramente aleatório. Cada carta possui significados detalhados para posição erecta e invertida, exibidos em um modal interativo.

O sistema suporta múltiplos tipos de tiragem, cada uma com posições e significados específicos. A sessão de leitura inclui um timer opcional para meditação e reflexão, e todas as leituras podem ser salvas no perfil do usuário ou compartilhadas nas redes sociais. A interpretação das cartas pode ser gerada por IA, considerando o contexto da tiragem, a pergunta do usuário e as combinações entre as cartas sorteadas.

---

## Baralhos Disponíveis

| Baralho | Cartas | Versão | Descrição |
|---|---|---|---|
| Rider-Waite-Smith | 78 (22+56) | MVP | Baralho padrão, imagens clássicas de Pamela Colman Smith |
| Tarot de Thoth | 78 (22+56) | V2 | Criado por Aleister Crowley e Lady Frieda Harris |
| Lenormand | 36 | V1 | Baralho de cartas ciganas francesas (ver módulo dedicado) |

## Tipos de Tiragem

| Tiragem | Cartas | Posições | Versão |
|---|---|---|---|
| Carta Única | 1 | Conselho do dia | MVP |
| Três Cartas | 3 | Passado, Presente, Futuro | MVP |
| Cruz Celta | 10 | Situação, Desafio, Base, Passado, Objetivo, Futuro, Eu, Ambiente, Esperanças, Resultado | V1 |
| Amor | 5 | Eu, Parceiro(a), Relacionamento, Desafio, Conselho | V1 |
| Sim/Não | 1 | Resposta direta | MVP |

## Arcanos Maiores (22 cartas)

| # | Carta | # | Carta |
|---|---|---|---|
| 0 | O Louco | 11 | A Força |
| 1 | O Mago | 12 | O Enforcado |
| 2 | A Sacerdotisa | 13 | A Morte |
| 3 | A Imperatriz | 14 | A Temperança |
| 4 | O Imperador | 15 | O Diabo |
| 5 | O Hierofante | 16 | A Torre |
| 6 | Os Enamorados | 17 | A Estrela |
| 7 | O Carro | 18 | A Lua |
| 8 | A Justiça | 19 | O Sol |
| 9 | O Eremita | 20 | O Julgamento |
| 10 | A Roda da Fortuna | 21 | O Mundo |

---

## Funcionalidades

- **Seleção de baralho** entre os disponíveis na plataforma
- **Tipos de tiragem** com posições e significados pré-definidos
- **Mecânicas de sorteio**: aleatório puro, ponderado (favoritando Arcanos Maiores), baseado em data (seed determinístico)
- **Modal de detalhe da carta** com significado erecto e invertido, imagem e palavras-chave
- **Sessão de leitura** com timer opcional para meditação
- **Salvar leituras** no perfil do usuário
- **Compartilhar leituras** via link público ou redes sociais
- **Interpretação por IA** com contexto da tiragem e pergunta do usuário

---

## Fluxo Principal

1. O usuário acessa a seção de Tarot no menu principal
2. Seleciona o baralho desejado (padrão: Rider-Waite-Smith)
3. Escolhe o tipo de tiragem (padrão: Carta Única)
4. Opcionalmente, digita uma pergunta ou intenção para a leitura
5. O sistema embaralha as cartas (com animação visual)
6. O usuário seleciona as cartas clicando nelas (ou o sistema sorteia automaticamente)
7. As cartas são reveladas com animação
8. O usuário pode tocar em cada carta para ver o modal de detalhes (ereto/invertido)
9. O sistema gera a interpretação por IA (se disponível no plano do usuário)
10. O usuário pode salvar a leitura ou compartilhar

> **Status (implementado, 2026-10-16):** o passo 9 roda **automaticamente** — `ReadingSession` (`src/components/tarot/reading-session.tsx`) monta `ReadingAIPanel` com `autoStart` assim que `createdReadingId` existe (1 chamada a `POST /ai/interpret` com `mode: "general"` por `readingId` **por aba de navegador** — o guard fica no `sessionStorage` `arkana-ai-autostart:<readingId>`, acessado via helpers try/catch em `reading-ai-panel.tsx`; um erro de storage não derruba a página). O guard é **liberado quando nada foi entregue** no unmount (abort simulado do React StrictMode, navegação no meio da geração), então a próxima montagem re-tenta — seguro porque o servidor devolve a quota em falha sem entrega (`docs/04-api/ai.md` §Reserva e devolução de quota). A seção de reveal **não** depende de `spread` estar carregado: sem spread, renderiza `Skeleton`, e os botões "Nova tiragem"/"Voltar" permanecem visíveis (correção do bug em que a tela inteira — incl. "Nova tiragem" — sumia quando `spread` era `undefined`). Regenerações e follow-ups manuais continuam sob demanda, consumindo quota adicional (`docs/04-api/ai.md` §Rate Limiting de IA). Detalhes do fluxo TDD desta sessão (2026-10-16): **(a)** o passo 4 (pergunta) é uma etapa dedicada e **opcional** na UX — `SessionStep` inclui `"question"` (`src/stores/reading-store.ts`), com `setQuestion` persistido no store (persist parcial + rehydrate mapeia `draw`→`question` para sessões antigas); o usuário pode pular via botão "Pular" (`reading-session.tsx`); **(b)** o reveal renderiza cartas + `ReadingAIPanel` lado a lado em `lg:grid-cols-2` no container `data-testid="reveal-grid"` (`reading-session.tsx`); **(c)** no autoStart o painel faz `scrollIntoView` uma única vez (guard `hasScrolledRef` em `reading-ai-panel.tsx` — não repete em re-renders); **(d)** a página de detalhe `/tiragem/[id]` (`src/app/(app)/tiragem/[id]/page.tsx`) tem botão "Nova tiragem" que chama `reset()` do store e navega para `/tirar` (teste: `tests/components/tiragem-detail-page.test.tsx`); **(e)** "Nova tiragem" agora fica no **header da seção reveal** (ao lado do título "Sua tiragem", acima do `reveal-grid`) com `variant` primário — ações secundárias ("Ver detalhes e interpretação"/"Compartilhar") permanecem sob as cartas (fix de proeminência, 2026-10-16, teste "'Nova tiragem' fica em posicao destacada" em `tests/components/reading-session.test.tsx`); **(f)** o painel usa `authStreamFetch` (401 → refresh single-flight → retry) para interpret/follow-up — access token expirado (TTL 15min) não força mais logout/login, e falha do provedor sem tokens anexa "Sua cota de interpretação não foi consumida." à mensagem (`docs/04-api/ai.md` §Comportamento do cliente SSE).

---

## Revelação e apresentação das cartas

> **Status (implementado, 2026-10-17):**

**Verso vs. frente (BR-TIR-002).** `CardBack`
(`src/components/tarot/card-back.tsx`) é a fonte única do verso (imagem do
baralho `cardBackImageUrl` + placeholder degradê). `TarotCard`
(`src/components/tarot/tarot-card.tsx`) renderiza o **verso** enquanto
`isFlipped` é `false`, e a **frente** (`imageUrl` = `card.imageUrl`) + nome +
badge "Invertida" quando `isFlipped` é `true`. Quando `isReversed`, a imagem da
frente é **rotacionada 180° no eixo Z** (de cabeça para baixo — spec 003 §1.4),
mantendo nome/badge legíveis. O verso vem do **baralho**, não da carta:
`ReadingSession` resolve `getDeckById(deckId)?.cardBackImageUrl` e repassa via
`CardTable` (`backImageUrl`); `DailyTarot` usa `DEFAULT_DECK_ID`.

**Revelação sequencial (BR-TIR-003).** As cartas viram **uma a uma, na ordem do
espalhamento**, com **1,5 s por carta**. Implementado no hook
`useSequentialReveal` (`src/hooks/use-sequential-reveal.ts`), que agenda o
reveal de cada carta pendente em `n * intervalMs` e cancela os timers no
unmount. `ReadingSession` usa `intervalMs = 1500` com
`enabled = step === "reveal"`. O usuário **pode adiantar** a revelação clicando
numa carta (a sequência automática continua para as demais); o reveal
automático só **liga** cartas ainda fechadas (`setFlippedCard` alterna), então
não "desvira" uma carta aberta manualmente. O callback `isRevealed` permite
**re-armar** a sequência ignorando cartas já reveladas (evita re-revelar ao
re-montar com progresso persistido). `DailyTarot` reusa o mesmo hook para
revelar sua única carta após 1,5 s (verso → frente), chaveado por id do dia.

**Resumo textual das cartas (acessibilidade/UX).** Abaixo da mesa, o reveal
mostra `data-testid="drawn-cards-summary"`: cresce conforme cada carta é
revelada, uma linha por carta no formato `Posição: Nome (invertida)`, para quem
não acompanha a animação visual.

**Dimensões das cartas (spec 003 §1.4).** Cada carta ocupa **largura e altura
explícitas em px** (proporção 4:7): `small` 80×140, `medium` 120×210 e `large`
180×315 (`TAROT_CARD_SIZES` em `tarot-card.tsx`, prop `size`, default
`medium`). Isso é obrigatório porque o wrapper `absolute` de cada posição da mesa
é *shrink-to-fit* — sem dimensões reais a carta **colapsava para 0×0** (fundo
branco, sem verso, sem animação). `CardTable` escolhe a variante pelo
`spread.cardCount`: **1 → large**, **2–3 → medium**, **4+ → small**; o overlay da
frente (nome + badge) escala junto (`CARD_OVERLAY`) para o nome não truncar em
zero caracteres em cartas de 80 px.

---

## Versão

| Feature | Versão |
|---|---|
| Tiragem simples (1 carta) | MVP |
| Tiragem de 3 cartas (Passado/Presente/Futuro) | MVP |
| Tiragem Sim/Não | MVP |
| Salvar e compartilhar leituras | MVP |
| Interpretação por IA | MVP |
| Cruz Celta (10 cartas) | V1 |
| Tiragem de Amor (5 cartas) | V1 |
| Baralho de Thoth | V2 |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| Autenticação | Módulo interno | Requerido para salvar/compartilhar leituras |
| Perfil | Módulo interno | Armazenamento de leituras no perfil |
| AI Service | Serviço interno | Geração de interpretações |
| CDN de imagens | Infraestrutura | Host das imagens das cartas |
| Banco de dados | Infraestrutura | Tabelas `readings`, `reading_cards`, `decks` |

---

## Critérios de Aceite

- **CA-01**: O sorteio de cartas deve ser verdadeiramente aleatório (teste de distribuição uniforme com margem de 5%)
- **CA-02**: O modal de detalhe deve exibir significado erecto e invertido, imagem da carta e palavras-chave em menos de 200ms
- **CA-03**: Uma tiragem de 3 cartas deve ser concluída (sorteio + revelação + interpretação IA) em menos de 10 segundos
- **CA-04**: Leituras salvas devem estar acessíveis no perfil do usuário com paginação de 20 itens por página
- **CA-05**: O compartilhamento deve gerar um link público que exiba a tiragem sem necessidade de login
