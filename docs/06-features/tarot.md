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
