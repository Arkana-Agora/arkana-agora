# SPEC-006: Horoscopos

**Plataforma**: Arkana Agora
**Versao**: MVP
**Status**: Pendente
**Data**: 2025-01-01

---

## 1. Visao Geral

Este documento define os requisitos do sistema de horoscopos do Arkana Agora. A plataforma oferece tres sistemas astrologicos distintos: Ocidental, Chines e Maia, cada um com seus proprios algoritmos de calculo e bases de dados de interpretacao.

---

## 2. Requisitos Funcionais

### RF-HORO-001: Horoscopo Ocidental
O sistema deve calcular e exibir o horoscopo ocidental baseado nos 12 signos do zodiaco:

**Signos e datas:**

| Signo | Data Inicio | Data Fim | Elemento | Regente |
---|---|---|---|---|
| Aries | 21/03 | 19/04 | Fogo | Marte |
| Touro | 20/04 | 20/05 | Terra | Venus |
| Gemeos | 21/05 | 20/06 | Ar | Mercurio |
| Cancer | 21/06 | 22/07 | Agua | Lua |
| Leao | 23/07 | 22/08 | Fogo | Sol |
| Virgem | 23/08 | 22/09 | Terra | Mercurio |
| Libra | 23/09 | 22/10 | Ar | Venus |
| Escorpiao | 23/10 | 21/11 | Agua | Plutao |
| Sagitario | 22/11 | 21/12 | Fogo | Jupiter |
| Capricornio | 22/12 | 19/01 | Terra | Saturno |
| Aquario | 20/01 | 18/02 | Ar | Urano |
| Peixes | 19/02 | 20/03 | Agua | Netuno |

**Periodicidades disponiveis:**
- **Diario**: texto de 150-250 palavras cobrindo amor, carreira e saude
- **Semanal**: texto de 300-500 palavras com previsao dia a dia (seg-dom)
- **Mensal**: texto de 500-800 palavras com previsao por semana e tema do mes

### RF-HORO-002: Horoscopo Chines
O sistema deve calcular e exibir o horoscopo chines baseado no ciclo sexagenario (60 anos):

**12 Animais do Zodiaco Chines:**

| Animal | Ultimos Anos | Caracteristicas | Elemento Yin/Yang |
---|---|---|---|
| Rato | 2020, 2008, 1996, 1984 | Inteligente, adaptavel, sociavel | Yang, Agua |
| Boi | 2021, 2009, 1997, 1985 | Trabalhador, confiavel, teimoso | Yin, Terra |
| Tigre | 2022, 2010, 1998, 1986 | Corajoso, competitivo, impulsivo | Yang, Madeira |
| Coelho | 2023, 2011, 1999, 1987 | Gentil, prudente, diplomata | Yin, Madeira |
| Dragao | 2024, 2012, 2000, 1988 | Carismatico, ambicioso, idealista | Yang, Terra |
| Serpente | 2025, 2013, 2001, 1989 | Sabio, enigmatico, intuitivo | Yin, Fogo |
| Cavalo | 2026, 2014, 2002, 1990 | Energetico, independente, impaciente | Yang, Fogo |
| Cabra | 2027, 2015, 2003, 1991 | Calmo, criativo, compassivo | Yin, Terra |
| Macaco | 2028, 2016, 2004, 1992 | Astuto, versatil, brincalhao | Yang, Metal |
| Galo | 2029, 2017, 2005, 1993 | Observador, hardworking, perfeccionista | Yin, Metal |
| Cao | 2030, 2018, 2006, 1994 | Leal, honesto, protetor | Yang, Terra |
| Porco | 2031, 2019, 2007, 1995 | Generoso, compassivo, indulgente | Yin, Agua |

**5 Elementos Chineses (Wu Xing):**
- Madeira (Mu): criatividade, crescimento
- Fogo (Huo): paixao, energia, dinamismo
- Terra (Tu): estabilidade, nutrição, confiança
- Metal (Jin): determinacao, estrutura, precisao
- Agua (Shui): sabedoria, fluidez, adaptabilidade

**Calculo do animal:** O ano do nascimento determina o animal. O ano chines começa entre 21 de janeiro e 20 de fevereiro (data variavel do Ano Novo Chines). Se o aniversario cai antes do Ano Novo Chines daquele ano, considerar o animal do ano anterior.

**Calculo do elemento:** (ano de nascimento - 4) mod 5
- 0 = Madeira
- 1 = Fogo
- 2 = Terra
- 3 = Metal
- 4 = Agua

### RF-HORO-003: Horoscopo Maia (Tzolkin)
O sistema deve calcular o Kin Maya baseado no Calendario Tzolkin (260 dias):

**Componentes do Kin:**
- **Selo Solar** (20 selos): identifica a energia essencial
- **Tom Galactico** (13 tons): identifica o tom/pulso da energia
- **Kin** = combinacao unica de Selo + Tom (20 x 13 = 260 combinacoes possiveis)

**20 Selos Solares:**

| # | Selo (PT) | Selo (EN) | Significado | Direcao | Cor |
---|---|---|---|---|---|
| 1 | Dragao Vermelho | Red Dragon | Nascimento, nutricao, ser | Leste | Vermelho |
| 2 | Vento Branco | White Wind | Espirito, comunicacao, respiracao | Norte | Branco |
| 3 | Noite Azul | Blue Night | Sonhos, abundancia, intuicao | Oeste | Azul |
| 4 | Semente Amarela | Yellow Seed | Florescimento, targeting, consciencia | Sul | Amarelo |
| 5 | Serpente Vermelha | Red Serpent | Sobrevivencia, instinto, kundalini | Leste | Vermelho |
| 6 | Enlaçador de Mundos Branco | White Worldbridger | Morte, igualdade, oportunidade | Norte | Branco |
| 7 | Mao Azul | Blue Hand | Conhecimento, realizacao, cura | Oeste | Azul |
| 8 | Estrela Amarela | Yellow Star | Arte, elegancia, beleza | Sul | Amarelo |
| 9 | Lua Vermelha | Red Moon | Purificacao, fluxo, agua universal | Leste | Vermelho |
| 10 | Cachorro Branco | White Dog | Amor, lealdade, coracao | Norte | Branco |
| 11 | Macaco Azul | Blue Monkey | Magia, ilusao, jogo | Oeste | Azul |
| 12 | Semente Amarela | Yellow Human | Livre-arbitrio, sabedoria, influencia | Sul | Amarelo |
| 13 | Caminhante do Ceu Vermelho | Red Skywalker | Espaco, exploracao, vigilia | Leste | Vermelho |
| 14 | Mago Branco | White Wizard | Receptividade, coracao, tempo | Norte | Branco |
| 15 | Aguia Azul | Blue Eagle | Visao, criatividade, mente | Oeste | Azul |
| 16 | Guerreiro Amarelo | Yellow Warrior | Inteligencia, questionamento, coragem | Sul | Amarelo |
| 17 | Terra Vermelha | Red Earth | Navegacao, sincronicidade, evolucao | Leste | Vermelho |
| 18 | Espelho Branco | White Mirror | Ordem, verdade, infinito | Norte | Branco |
| 19 | Tormenta Azul | Blue Storm | Transformacao, catalise, energia | Oeste | Azul |
| 20 | Sol Amarelo | Yellow Sun | Iluminacao, vida, universal | Sul | Amarelo |

**13 Tons Galacticos:**

| # | Tom | Palavra-chave | Acao | Poder |
---|---|---|---|---|
| 1 | Magnetico | Unificar | Atrair | Proposito |
| 2 | Lunar | Polarizar | Estabilizar | Desafio |
| 3 | Eletrico | Ativar | Servir | Servir |
| 4 | Auto-existente | Definir | Medir | Forma |
| 5 | Ondulado | Empoderar | Comandar | Radiância |
| 6 | Ritmico | Organizar | Equilibrar | Igualdade |
| 7 | Ressonante | Inspire | Canalizar | Armonização |
| 8 | Galactico | Modelar | Harmonizar | Integridade |
| 9 | Solar | Pulsear | Realizar | Intencao |
| 10 | Planetario | Perfurar | Produzir | Manifestação |
| 11 | Espectral | Dissolver | Libertar | Liberação |
| 12 | Cristal | Dedicar | Universalizar | Cooperacao |
| 13 | Cosmico | Endurecer | Transcender | Presença |

### RF-HORO-004: Calculo Automatico
O sistema deve calcular automaticamente todos os horoscopos com base na data de nascimento do usuario:
- Ocidental: determinacao do signo solar (RF-HORO-001)
- Chines: determinacao do animal e elemento (RF-HORO-002)
- Maia: calculo do Kin via conversao gregoriana para Contagem Longa Maia, depois para Tzolkin (RF-HORO-003)

Os resultados sao exibidos na pagina de perfil e na pagina dedicada de horoscopos.

### RF-HORO-005: Exibicao de Interpretacoes Personalizadas
Cada sistema deve exibir interpretacoes personalizadas que variam por:
- Periodo (diario, semanal, mensal)
- Signo/Animal/Kin do usuario
- As interpretacoes devem ser armazenadas em banco e podem ser pre-geradas por IA ou escritas manualmente pela equipe

### RF-HORO-006: IA para Interpretacoes Detalhadas
O usuario pode solicitar uma interpretacao mais detalhada gerada por IA:
- Utiliza o mesmo pipeline de streaming da SPEC-004
- Contexto: sistema + signo/animal/kin + periodo + perfil do usuario
- Conta como 1 uso da cota diaria de IA

### RF-HORO-007: Historico de Horoscopos Consultados
O sistema deve manter um historico dos horoscopos consultados pelo usuario:
- Armazenar: data de consulta, tipo de horoscopo, signo/animal/kin, periodo
- Pagina de historico com lista paginada
- Possibilidade de acessar horoscopos passados (se ainda disponiveis)

### RF-HORO-008: Notificacoes de Horoscopo Diario
O sistema deve enviar notificacao push/in-app com o horoscopo diario:
- Horario de envio: 07:00 BRT (configuravel pelo usuario)
- Apenas para o horoscopo ocidental diario (padrao)
- Usuario pode ativar/desativar por sistema (ocidental, chines, maia)
- Implementado via cron job que gera/envia as notificacoes
- O conteudo deve ser gerado previamente (nao em tempo real)

---

## 3. Requisitos Nao Funcionais

### RNF-HORO-001: Disponibilidade
Os horoscopos diarios devem estar disponiveis ate as 06:00 BRT de cada dia para consulta imediata. A geracao de conteudo diario (por IA ou manual) deve ocorrer as 04:00 BRT.

### RNF-HORO-002: Performance
A pagina de horoscopo deve carregar em menos de 800ms (P95). O calculo do Kin Maya deve ser executado em menos de 1ms.

---

## 4. Dependencias

| Dependencia | Versao | Proposito |
---|---|---|
| z-ai-web-dev-sdk | latest | Interpretacoes IA |
| node-cron | >=3.x | Agendamento de geracao diaria |
| Zod | >=3.x | Validacao de datas |

---

## 5. Criterios de Aceite

| ID | Criterio | Metodo de Validacao |
---|---|---|
| CA-HORO-001 | Um usuario nascido em 15/06/1990 ve "Gemeos" como signo ocidental, "Cavalo de Metal" no horoscopo chines e o Kin Maya correto para essa data | Teste de integracao |
| CA-HORO-002 | O horoscopo diario exibe texto diferente para cada signo e e atualizado as 04:00 BRT | Verificacao de dados no banco + horario de atualizacao |
| CA-HORO-003 | O historico de horoscopos lista todas as consultas com paginacao | Teste E2E |
| CA-HORO-004 | A notificacao push e enviada as 07:00 BRT para usuarios com a opcao ativada | Teste com cron job simulado |
| CA-HORO-005 | A interpretacao IA detalhada e gerada em streaming e menciona o signo e o periodo | Teste E2E |