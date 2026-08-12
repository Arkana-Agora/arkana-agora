# SPEC-003: Motor de Tiragem

**Plataforma**: Arkana Agora
**Versao**: MVP
**Status**: Pendente
**Data**: 2025-01-01

---

## 1. Visao Geral

Este documento define os requisitos do Motor de Tiragem do Arkana Agora. O motor e responsavel por todo o fluxo de selecao de baralho, escolha de espalhamento, sorteio aleatorio de cartas, exibicao de detalhes e salvamento das leituras realizadas.

---

## 2. Requisitos Funcionais

### RF-TAROT-001: Selecao de Baralho
O sistema deve oferecer a escolha entre os seguintes baralhos:

- **Rider-Waite-Smith (RWS)**: 78 cartas (22 Arcanos Maiores + 56 Arcanos Menores). Baralho padrao, imagens classicas de Pamela Colman Smith.
- **Thoth**: 78 cartas (22 Arcanos Maiores + 56 Arcanos Menores). Criado por Aleister Crowley e Lady Frieda Harris. Nomenclatura e numeracao diferem do RWS em varias cartas (ex.: Arcano I = O Mago no RWS vs. A Forca no Thoth).
- **Lenormand (Cartas Ciganas)**: 36 cartas numeradas de 1 a 36. Cada carta possui um nome, um numero e um significado basico. NAO possui arc menores/maiores nem orientacao reversa.

A selecao do baralho deve ocorrer antes da escolha do espalhamento. Cada baralho possui metadados: nome, descricao, numero de cartas, autor, ano de criacao.

### RF-TAROT-002: Tipos de Espalhamento
O sistema deve oferecer os seguintes espalhamentos, cada um com posicoes nomeadas:

**Tarot (RWS/Thoth):**
- **Carta Unica**: 1 carta. Posicoes: ["Conselho do dia"]. Tempo estimado: 30s.
- **Tres Cartas**: 3 cartas. Posicoes: ["Passado", "Presente", "Futuro"]. Tempo estimado: 2min.
- **Cruz Celta (Celtic Cross)**: 10 cartas. Posicoes: ["Situacao atual", "Desafio", "Base inconsciente", "Passado recente", "Melhor resultado", "Futuro proximo", "Voce mesmo", "Influencia externa", "Esperancas e medos", "Resultado final"]. Tempo estimado: 10min.
- **Cruz do Amor**: 7 cartas. Posicoes: ["Voce", "O outro", "A conexao", "Desafios", "Forcas favoraveis", "Aconselhamento", "Resultado"]. Tempo estimado: 7min.
- **Sim/Nao**: 1 carta. Posicoes: ["Resposta"]. Regra: cartas de Arcano Maior pares (0,2,4,6,8,10,12,14,16,18,20) = Sim; impares (1,3,5,7,9,11,13,15,17,19,21) = Nao. Cartas de Arcano Menor dependem do naipe.

**Lenormand:**
- **Tres Cartas**: 3 cartas. Posicoes: ["Passado", "Presente", "Futuro"]. Leitura combinada.
- **Cinco Cartas**: 5 cartas. Posicoes: ["Voce", "O que cruza", "O que esta abaixo", "O que esta acima", "Resultado"].
- **Nove Cartas (Grande Tabuleiro simplificado)**: 9 cartas em grid 3x3. Leitura por linhas, colunas e diagonais.

### RF-TAROT-003: Mecanica de Sorteio
O sistema deve implementar o sorteio de cartas com as seguintes regras:
- Utilizar `crypto.getRandomValues()` como fonte de aleatoriedade (CSPRNG), nao `Math.random()`
- Criar um seed derivado do timestamp + userId + deckId para permitir reproducao
- Nao repetir cartas dentro de uma mesma tiragem (sem reposicao)
- Para Lenormand, nao repetir cartas no espalhamento
- Permitir re-sortear todas as cartas (botao "Embaralhar novamente") com nova animacao
- Registrar o seed utilizado na leitura salva para auditoria

### RF-TAROT-004: Detalhe da Carta
Ao selecionar uma carta tirada, o sistema deve exibir um painel de detalhes contendo:
- **Imagem da carta**: ilustracao completa, responsiva
- **Nome**: nome da carta em portugues
- **Numero/Naipe**: para Arcanos Menores, exibir naipe (Copas, Espadas, Paus, Ouros) e valor (As a Rei)
- **Orientacao**: "Direita" ou "Reversa" (nao aplicavel a Lenormand)
- **Palavras-chave**: 3-5 palavras que resumem o significado
- **Significado geral**: texto descritivo de 2-3 paragrafos
- **Significado no contexto da posicao**: adaptado ao espalhamento selecionado
- **Conselho pratico**: frase de aconselhamento
- **Arcano pessoal**: indicador se a carta corresponde ao arcano pessoal do usuario (destaque visual)

A exibicao reversa deve inverter os significados e alterar as palavras-chave.

### RF-TAROT-005: Sessao de Leitura com Timer
O sistema deve gerenciar uma sessao de leitura completa:
- **Fase 1 - Preparacao**: usuario seleciona baralho e espalhamento
- **Fase 2 - Sorteio**: cartas sao reveladas com animacao sequencial (delay configuravel: 300ms padrao)
- **Fase 3 - Leitura**: usuario pode clicar em cada carta para ver detalhes, navegar livremente
- **Fase 4 - Resumo**: usuario pode solicitar interpretacao IA (SPEC-004) ou finalizar
- Timer opcional exibido no canto superior: conta o tempo da sessao
- Auto-save do estado da sessao a cada 30 segundos (para recuperar em caso de reload)

### RF-TAROT-006: Salvamento de Tiragem
O sistema deve permitir salvar a tiragem realizada:
- Dados salvos: userId, deckId, spreadId, cartas (posicao, cartaId, orientacao, seed), data/hora, tempo de leitura
- Titulo opcional da tiragem (ate 100 caracteres)
- Notas pessoais opcionais (ate 1000 caracteres)
- Acesso via historico na pagina "Minhas Tiragens"
- Tiragens sao privadas por padrao; opcao de tornar publica
- Limite de armazenamento: ilimitado para Plus, 50 mais recentes para Free

### RF-TAROT-007: Compartilhamento
O sistema deve permitir o compartilhamento de tiragens:
- **Link direto**: URL unica `/tiragem/[id]` (se publica) ou URL temporaria com token (se privada)
- **Imagem OG (Open Graph)**: gerar imagem 1200x630px com as cartas da tiragem para preview em redes sociais
- Geracao da imagem OG via API Route com canvas (ou HTML-to-image)
- Compartilhamento nativo via Web Share API (mobile) e botoes de redes sociais (desktop)
- **Exportar como imagem**: download em PNG da tiragem completa com fundo tematico

### RF-TAROT-008: Limite de Tiragens Diarias
O sistema deve implementar limites de uso por plano:
- **Plano Free**: maximo 3 tiragens por dia (reset as 00:00 BRT)
- **Plano Plus**: maximo 10 tiragens por dia (ADR-009)
- Contador exibido na UI: "Voce fez 2 de 3 tiragens hoje"
- Quando o limite e atingido: modal informativo com CTA para upgrade
- Leituras de tiragens ja salvas nao contam como nova tiragem
- Re-sortear dentro da mesma sessao nao conta como nova tiragem

---

## 3. Requisitos Nao Funcionais

### RNF-TAROT-001: Performance de Animacoes
Todas as animacoes de revelacao de cartas devem rodar a 60fps em dispositivos moveis medianos (Moto G系列). Utilizar transformacoes CSS (transform, opacity) e evitar animacoes que disparem reflow/repaint.

### RNF-TAROT-002: Tamanho do Bundle
Os dados dos 3 baralhos (78 + 78 + 36 = 192 cartas) devem ser carregados sob demanda (lazy) ou via code splitting. O bundle inicial NAO deve incluir imagens de cartas. As imagens devem ser carregadas progressivamente (blur placeholder + full image).

### RNF-TAROT-003: Tempo de Salvamento
O salvamento de uma tiragem deve ser concluido em menos de 500ms (P95), incluindo a persistencia de todas as cartas e metadados.

---

## 4. Dependencias

| Dependencia | Versao | Proposito |
|---|---|---|
| Framer Motion | >=11.x | Animacoes de revelacao de cartas |
| html-to-image | >=1.x | Geracao de imagem para compartilhamento OG |
| Zustand | >=4.x | Estado da sessao de leitura |
| Prisma | >=5.x | Persistencia de tiragens |

---

## 5. Criterios de Aceite

| ID | Criterio | Metodo de Validacao |
|---|---|---|
| CA-TAROT-001 | O usuario seleciona o baralho RWS, escolhe o espalhamento "Tres Cartas", ve 3 cartas diferentes reveladas com animacao fluida a 60fps | Teste E2E com validacao de FPS (Chrome DevTools) |
| CA-TAROT-002 | Ao selecionar o baralho Lenormand, o espalhamento "Cinco Cartas" e exibido e as 5 cartas sao sorteadas sem repeticao | Teste de integracao com seed controlado |
| CA-TAROT-003 | Uma tiragem salva com titulo e notas e recuperada na pagina "Minhas Tiragens" com todos os dados intactos | Teste E2E de salvar e recuperar |
| CA-TAROT-004 | Ao compartilhar uma tiragem publica, o preview em redes sociais exibe a imagem OG correta com as cartas | Teste manual com Facebook/WhatsApp Debugger |
| CA-TAROT-005 | Um usuario Free que ja fez 3 tiragens hoje ve o modal de limite com opcao de upgrade, e nao consegue iniciar uma nova tiragem | Teste E2E |