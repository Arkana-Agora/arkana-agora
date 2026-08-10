# Lenormand (Cartas Ciganas) — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Lenormand | **Versão**: V1

---

## Descrição

O módulo de Lenormand traz ao **Arkana Agora** o sistema tradicional de 36 cartas ciganas de origem francesa, nomeado em homenagem à famosa cartomante Marie Anne Lenormand. Diferente do Tarot, as cartas de Lenormand possuem significados mais diretos e literais, e a interpretação se baseia fortemente nas **combinações** entre cartas vizinhas — a distância entre duas cartas altera significativamente seu significado conjunto.

O sistema suporta desde tiragens simples (3 a 5 cartas) até o **Grand Tableau** completo, onde todas as 36 cartas são dispostas em uma grade de 4×9. O módulo inclui um dicionário completo de combinações de cartas (36×36 = 1.296 pares), com significados diferenciados para cartas próximas (lado a lado) e distantes na mesa. A interpretação por IA é adaptada para o estilo literal e prático das cartas Lenormand.

---

## As 36 Cartas de Lenormand

| # | Carta | Palavras-chave | # | Carta | Palavras-chave |
|---|---|---|---|---|---|
| 1 | Cavaleiro | Mensagem, notícia, movimento | 19 | Torre | Isolamento, autoridade, proteção |
| 2 | Trevo | Sorte, oportunidade, leveza | 20 | Jardim | Socialização, festa, comunidade |
| 3 | Navio | Viagem, comércio, distância | 21 | Montanha | Obstáculo, atraso, desafio |
| 4 | Casa | Estabilidade, família, segurança | 22 | Caminhos | Escolha, decisão, encruzilhada |
| 5 | Árvore | Saúde, crescimento, longevidade | 23 | Rato | Perda, desgaste, economia |
| 6 | Nuvens | Confusão, incerteza, dúvida | 24 | Coração | Amor, afeto, paixão |
| 7 | Serpente | Traição, complicação, sabedoria | 25 | Anel | Compromisso, contrato, aliança |
| 8 | Caixão | Fim, transformação, renovação | 26 | Livro | Segredo, estudo, conhecimento |
| 9 | Buquê | Harmonia, presente, gentileza | 27 | Carta | Comunicação, documento, mensagem |
| 10 | Foice | Corte, decisão repentina, colheita | 28 | Cavalheiro | Homem, visitante, cortejador |
| 11 | Chicote | Conflito, disputa, repetição | 29 | Senhora | Mulher, visitante, cortejadora |
| 12 | Pássaros | Conversa, notícias, leveza | 30 | Lírio | Pureza, paz, sabedoria |
| 13 | Criança | Novidade, inocência, pequeno | 31 | Sol | Sucesso, alegria, vitalidade |
| 14 | Raposa | Astúcia, cautela, trabalho | 32 | Lua | Honra, reconhecimento, intuição |
| 15 | Urso | Força, proteção, autoridade | 33 | Chave | Solução, abertura, certeza |
| 16 | Estrelas | Esperança, espiritualidade, destino | 34 | Peixes | Abundância, dinheiro, negócios |
| 17 | Cegonha | Mudança, nova oportunidade, fertlidade | 35 | Âncora | Estabilidade, segurança, constância |
| 18 | Cão | Lealdade, amizade, companhia | 36 | Cruz | Sacrifício, fardo, espiritualidade |

---

## Tipos de Tiragem

| Tiragem | Cartas | Descrição | Versão |
|---|---|---|---|
| Simples | 3 | Passado, Presente, Futuro | V1 |
| Relacionamento | 5 | Eu, Outro, Conexão, Desafio, Futuro | V1 |
| GT Reduzido | 9 | Versão menor do Grand Tableau | V1 |
| Grand Tableau | 36 | Todas as 36 cartas em grade 4×9 | V1 |

---

## Funcionalidades

- **Baralho completo de 36 cartas** com imagens e significados tradicionais franceses
- **Grand Tableau** com disposição em grade 4×9 e leitura posicional
- **Tiragens menores** (3, 5 e 9 cartas) com posições específicas
- **Dicionário de combinações** (1.296 pares) com significados para pares próximos e distantes
- **Interpretação por IA** especializada no estilo literal e prático de Lenormand
- **Leitura posicional no Grand Tableau** (casa pessoal, temas de vida)
- **Salvar e compartilhar** leituras de Lenormand

---

## Fluxo Principal

1. O usuário acessa a seção "Lenormand" no menu principal
2. Seleciona o tipo de tiragem (padrão: 3 cartas simples)
3. Opcionalmente, digita uma pergunta ou intenção
4. O sistema embaralha e o usuário seleciona as cartas
5. As cartas são reveladas com seus significados individuais
6. O sistema calcula as combinações entre cartas vizinhas
7. A IA gera a interpretação no estilo Lenormand (literal, prática, direta)
8. O usuário visualiza a leitura completa e pode salvar ou compartilhar
9. No Grand Tableau, o usuário pode tocar em qualquer posição para ver a combinação com as cartas adjacentes

---

## Versão

| Feature | Versão |
|---|---|
| Tiragens simples (3, 5 cartas) | V1 |
| Grand Tableau completo | V1 |
| Dicionário de combinações | V1 |
| Interpretação IA para Lenormand | V1 |
| GT com tema específico (amor, dinheiro, saúde) | V2 |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| Autenticação | Módulo interno | Requerido para salvar leituras |
| Tarot | Módulo interno | Infraestrutura compartilhada de sorteio |
| AI Service | Serviço interno | Interpretação especializada Lenormand |
| CDN de imagens | Infraestrutura | Host das imagens das 36 cartas |

---

## Critérios de Aceite

- **CA-01**: Todas as 36 cartas devem possuir significado individual, palavras-chave e imagem de alta resolução
- **CA-02**: O dicionário de combinações deve cobrir pelo menos 1.000 dos 1.296 pares possíveis, com significados distintos para cartas próximas e distantes
- **CA-03**: O Grand Tableau deve renderizar em menos de 2 segundos e permitir navegação interativa entre posições
- **CA-04**: A interpretação IA deve utilizar o vocabulário e o estilo característicos de Lenormand (literal, prático), diferenciando-se claramente do estilo do Tarot
- **CA-05**: O sorteio deve garantir que não haja cartas repetidas em uma mesma tiragem
