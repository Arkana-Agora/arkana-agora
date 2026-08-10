# SPEC-004: Leituras por IA

**Plataforma**: Arkana Agora
**Versao**: MVP
**Status**: Pendente
**Data**: 2025-01-01

---

## 1. Visao Geral

Este documento define os requisitos do sistema de interpretacao de tiragens por inteligencia artificial no Arkana Agora. O sistema utiliza o modelo GPT-4o (via z-ai-web-dev-sdk) para gerar interpretacoes contextuais das cartas tiradas, com suporte a streaming para experiencia em tempo real.

---

## 2. Requisitos Funcionais

### RF-AI-001: Interpretacao IA de Tiragem Completa (Streaming)
O sistema deve gerar uma interpretacao textual completa de uma tiragem ja realizada, utilizando o modelo GPT-4o. A interpretacao deve:
- Ser gerada em streaming (Server-Sent Events) para exibicao progressiva no cliente
- Comecar com uma introducao que contextualiza a tiragem como um todo
- Interpretar cada carta individualmente no contexto de sua posicao no espalhamento
- Apresentar uma sintese/resultado final que conecta todas as cartas
- Ser escrita em portugues brasileiro, com tom empatico e respeitoso
- Ter tamanho entre 300 e 800 palavras (dependendo do numero de cartas)
- Citar os nomes das cartas e suas posicoes ao longo do texto
- Nao utilizar linguagem determinista ("voce vai..."), preferindo construtos probabilisticos ("esta tiragem sugere...", "as cartas indicam uma tendencia...")

### RF-AI-002: Modos de Interpretacao
O sistema deve oferecer os seguintes modos de interpretacao, selecionaveis pelo usuario antes de solicitar a leitura:

- **Geral**: interpretacao abrangente, sem foco especifico. Equilibrada entre todos os aspectos da vida.
- **Amor e Relacionamentos**: foco em romances, parcerias, conflitos emocionais e compatibilidade. Considera o estado civil e o genero informados no perfil (se disponiveis).
- **Carreira e Financas**: foco em projetos profissionais, decisoes financeiras, crescimento na carreira e estabilidade material.
- **Sim/Nao**: resposta direta a uma pergunta do usuario. Aceita uma pergunta textual (ate 200 caracteres) e responde com "Sim", "Nao" ou "Inconclusivo", seguido de justificativa de 1 paragrafo.

A selecao do modo altera o prompt de sistema e o contexto fornecido ao modelo.

### RF-AI-003: Prompt Contextual
O sistema deve construir prompts dinamicos que incluam:
- **Cartas tiradas**: nome, numero/naipe, orientacao (direita/reversa) e posicao no espalhamento
- **Significado da posicao**: descricao do que cada posicao representa no espalhamento
- **Mood do usuario**: opcionalmente, o usuario pode selecionar seu estado emocional atual (Animado, Ansioso, Reflexivo, Triste, Esperancoso, Cansado) para contextualizar a interpretacao
- **Modo selecionado**: altera as instrucoes do sistema
- **Pergunta do usuario**: no modo Sim/Nao, inclui a pergunta literal
- **Dados do perfil**: signo solar e arcano pessoal (se disponiveis) como contexto adicional
- **Historico recente**: as 3 ultimas tiragens do usuario (resumo de 1 frase cada) para detectar padroes

### RF-AI-004: Follow-up Chat sobre Leitura
Apos receber a interpretacao, o usuario deve poder fazer perguntas de acompanhamento em formato de chat:
- Interface de chat inline, abaixo da interpretacao
- O usuario pode enviar mensagens de texto (ate 500 caracteres cada)
- Cada mensagem do usuario e adicionada ao contexto da conversa
- A IA responde considerando o historico da conversa E as cartas da tiragem
- Limite de 10 mensagens por sessao de follow-up (Free) / 30 (Plus)
- Opcao "Nova pergunta" para iniciar uma nova sessao de follow-up na mesma tiragem
- As mensagens do chat sao salvas e associadas a tiragem

### RF-AI-005: Rate Limiting de Interpretacoes
O sistema deve limitar o uso da IA por plano:
- **Plano Free**: 10 interpretacoes por dia (inclui follow-ups) + 3 interpretacoes de tiragem
- **Plano Plus**: interpretacoes ilimitadas
- Contador exibido na UI apos cada uso
- Quando o limite diario e atingido: modal com CTA para upgrade
- Reset as 00:00 BRT

### RF-AI-006: Caching de Interpretacoes Identicas
Para otimizar custos e latencia, o sistema deve implementar cache de interpretacoes:
- Hash de cache: SHA-256 de (deckId + spreadId + cardIdsOrdenados + orientations + modo)
- Se uma interpretacao com o mesmo hash ja existe no banco, retorne-a diretamente sem chamar a IA
- O cache e invalidado se o modelo GPT-4o for atualizado (versao do modelo no hash)
- Ao servir do cache, exiba aviso sutil: "Esta interpretacao foi gerada anteriormente"
- Caching nao se aplica ao follow-up chat (sempre gerado em tempo real)
- Tempo de vida do cache: 30 dias

---

## 3. Requisitos Nao Funcionais

### RNF-AI-001: Latencia de Primeiro Token
O primeiro token da interpretacao deve chegar ao cliente em menos de 3 segundos apos a requisicao (P95).

### RNF-AI-002: Throughput de Streaming
Os tokens devem chegar a uma taxa de pelo menos 20 tokens/segundo em condicoes normais, garantindo uma experiencia de leitura fluida.

### RNF-AI-003: Tolerancia a Falhas
Em caso de falha na API de IA (timeout, erro 5xx, quota excedida), o sistema deve:
- Retentar ate 2 vezes com backoff exponencial (1s, 3s)
- Se persistir, exibir mensagem amigavel em portugues: "Nao foi possivel gerar a interpretacao agora. Tente novamente em alguns minutos."
- Registrar o erro nos logs com contexto completo para debugging

---

## 4. Dependencias

| Dependencia | Versao | Proposito |
|---|---|---|
| z-ai-web-dev-sdk | latest | Acesso ao modelo GPT-4o |
| OpenAI GPT-4o | - | Modelo de linguagem para geracao de texto |
| Zod | >=3.x | Validacao de inputs e outputs |
| Prisma | >=5.x | Persistencia de interpretacoes e chat |

---

## 5. Criterios de Aceite

| ID | Criterio | Metodo de Validacao |
|---|---|---|
| CA-AI-001 | O usuario solicita interpretacao no modo Geral e recebe texto streaming em portugues que menciona todas as cartas e posicoes da tiragem | Teste E2E com verificacao de conteudo |
| CA-AI-002 | O modo Sim/Nao aceita uma pergunta e retorna "Sim", "Nao" ou "Inconclusivo" com justificativa | Teste de integracao com 10 perguntas variadas |
| CA-AI-003 | O follow-up chat permite 3 trocas de mensagens com respostas contextuais baseadas nas cartas | Teste E2E de chat |
| CA-AI-004 | Uma segunda solicitacao com as mesmas cartas e modo retorna o resultado do cache (sem chamada a API) | Teste de integracao com mock da API |
| CA-AI-005 | O 11o uso diario da IA por um usuario Free exibe modal de limite | Teste E2E |