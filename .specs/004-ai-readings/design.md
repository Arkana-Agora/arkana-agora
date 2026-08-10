# SPEC-004: Leituras por IA -- Design Tecnico

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## 1. Componentes de Interface

### 1.1 InterpretationRequest
- Painel exibido apos a revelacao das cartas na sessao de leitura
- Selecao do modo: chips/botoes (Geral, Amor, Carreira, Sim/Nao)
- Campo de pergunta (visivel apenas no modo Sim/Nao, ate 200 caracteres)
- Seletor de mood: chips com emojis neutros (sem emojis visuais, apenas texto)
- Botao "Gerar Interpretacao" com icone de IA
- Indicador de uso: "Voce usou 3 de 10 interpretacoes hoje"

### 1.2 StreamingInterpretation
- Area de texto que recebe o streaming de tokens
- Efeito de maquina de escrever: cada token adicionado com animacao sutil de opacidade (0.5 -> 1.0)
- Botao "Parar geracao" visivel durante o streaming
- Ao completar: botoes de acao aparecem ("Fazer perguntas", "Salvar", "Compartilhar")
- Markdown renderizado: suporte a negrito, italico, listas e paragrafos
- Tamanho de fonte responsivo (18px mobile, 20px desktop)

### 1.3 FollowUpChat
- Interface de chat inline, abaixo da interpretacao
- Historico de mensagens com avatares (usuario = avatar do perfil, IA = icone do Arkana Agora)
- Campo de input com botao de enviar
- Indicador de digitacao ("A IA esta escrevendo...") com animacao de pontos
- Limite de caracteres exibido ("XXX/500")
- Contador de mensagens restantes ("5 de 10 mensagens")
- Botoes de contexto rapido: sugestoes de perguntas baseadas na tiragem (ate 3 sugestoes geradas junto com a interpretacao)

### 1.4 AIUsageIndicator
- Componente reutilizavel exibido em varios pontos da UI
- Formato: barra circular ou texto "X/Y hoje"
- Cor verde (disponivel), amarela (poucas restantes), vermelha (esgotado)
- Tooltip com data de reset ("Renova amanha as 00:00")

### 1.5 CachedInterpretationNotice
- Aviso sutil (fundo translucido, icone de info) exibido quando a interpretacao vem do cache
- Texto: "Esta interpretacao foi gerada anteriormente para a mesma combinacao de cartas."

---

## 2. Arquitetura do Pipeline de IA

```
    PIPELINE DE INTERPRETACAO IA
    =============================

    CLIENTE                              SERVIDOR (API Route)
    =======                              ====================

    [1] Clica "Gerar Interpretacao"
         |  { readingId, mode, mood?, question? }
         v
    [2] POST /api/v1/ai/interpret  ------>  [3] Verifica autenticacao e plano
         |                                      |
         |                                      v
         |                                 [4] Verifica rate limit diario
         |                                      |  -> 429 se excedido
         |                                      v
         |                                 [5] Busca a tiragem no banco
         |                                      |  (cartas, posicoes, baralho)
         |                                      v
         |                                 [6] Calcula hash de cache
         |                                      |  SHA-256(deckId + spreadId + 
         |                                      |  cards + orientations + mode)
         |                                      v
         |                                 [7] Busca no cache
         |                                      |
         |                                      +-- HIT:  retorna cached
         |                                      |          (NAO streaming)
         |                                      |
         |                                      +-- MISS: continua
         |                                      v
         |                                 [8] Constroi prompt de sistema
         |                                      |
         |                                      v
         |                                 [9] Constroi prompt de usuario
         |                                      |  (cartas + posicoes + mood +
         |                                      |   perfil + historico)
         |                                      v
         |                                 [10] Chamada z-ai-web-dev-sdk
         |                                      |  (GPT-4o, stream=true)
         |                                      v
    [11] SSE: token por token   <--------  [12] Faz stream dos tokens
         |                                      |
         v                                 [13] Ao completar:
    [14] Renderiza texto                 |  Salva interpretacao completa
         |  no StreamingInterpretation     |  no banco de dados
         |                                 |  Atualiza cache
         v                                 v
```

---

## 3. Templates de Prompt

### 3.1 Prompt de Sistema (Base)

```
Voce e um tarologo e interprete de cartas de tarot e cartas ciganas (Lenormand) 
com mais de 30 anos de experiencia. Voce atua na plataforma Arkana Agora.

Regras absolutas:
- Responda SEMPRE em portugues brasileiro.
- Nao use linguagem determinista. Prefira: "esta tiragem sugere", "as cartas 
  indicam", "uma possibilidade e", "os simbolos apontam para".
- Nao faca diagnosticos medicos, legais ou financeiros.
- Nao substitua acompanhamento profissional (terapeutico, medico, juridico).
- Mantenha um tom empatico, respeitoso e acolhedor.
- Cite os nomes das cartas e suas posicoes no espalhamento.
- Considere a orientacao (direita ou reversa) de cada carta.
- Estruture a resposta com: Introducao, Interpretacao por carta, Sintese final.
- Use formatacao markdown (negrito para nomes de cartas, listas quando apropriado).
```

### 3.2 Prompt de Sistema por Modo

**Modo Geral**: Adicionar ao base: `"Apresente uma interpretacao equilibrada que abrange todos os aspectos da vida do consulente."`

**Modo Amor**: Adicionar ao base: `"Foque sua interpretacao em amor, relacionamentos, parcerias, conflitos emocionais e questoes do coracao. Se o perfil indicar estado civil, considere-o."`

**Modo Carreira**: Adicionar ao base: `"Foque sua interpretacao em carreira, projetos profissionais, decisoes financeiras, crescimento e estabilidade material."`

**Modo Sim/Nao**: Substituir completamente: `"O usuario fara uma pergunta especifica. Responda PRIMEIRO com uma unica palavra: 'Sim', 'Nao' ou 'Inconclusivo'. Depois, em um unico paragrafo, justifique sua resposta com base nas cartas tiradas."`

### 3.3 Prompt de Usuario (Exemplo - Modo Geral)

```
Tiragem realizada com o baralho Rider-Waite-Smith no espalhamento Tres Cartas.

Estado emocional do consulente: Reflexivo
Signo solar: Escorpiao
Arcano pessoal: O Hierofante (V)

Cartas:
1. Posicao "Passado": O Louco (0) - DIREITA
   Significado: Novos comȩos, liberdade, aventura, risco calculado.
2. Posicao "Presente": A Torre (16) - REVERSA
   Significado: Evitar mudancas drásticas, resistir a transformacoes, medo do desconhecido.
3. Posicao "Futuro": A Estrela (17) - DIREITA
   Significado: Esperaņa, renovaçao, inspiraçao, cura espiritual.

Gere a interpretacao completa desta tiragem.
```

### 3.4 Prompt de Follow-up

```
Contexto: O usuario esta fazendo uma pergunta de acompanhamento sobre uma tiragem ja interpretada.

Tiragem original: [resumo da tiragem com cartas e posicoes]
Interpretacao anterior: [texto completo da interpretacao gerada]

Historico desta conversa:
{messages}

Pergunta do usuario: {userMessage}

Responda de forma concisa (2-3 paragrafos), referenciando as cartas da tiragem quando relevante.
```

---

## 4. Implementacao SSE (Server-Sent Events)

### 4.1 API Route (App Router)

```typescript
// app/api/v1/ai/interpret/route.ts

export async function POST(request: Request) {
  const body = await request.json();
  // 1. Validar com Zod
  // 2. Verificar autenticacao
  // 3. Verificar rate limit
  // 4. Buscar tiragem
  // 5. Calcular hash e verificar cache
  // 6. Se cache HIT: retornar JSON normal
  // 7. Se cache MISS: iniciar stream

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Chamada ao z-ai-web-dev-sdk com stream
        const aiResponse = await ai.chat.completions.create({
          model: 'gpt-4o',
          messages: [systemPrompt, userPrompt],
          stream: true,
          max_tokens: 2000,
          temperature: 0.8,
        });

        let fullText = '';
        for await (const chunk of aiResponse) {
          const token = chunk.choices[0]?.delta?.content || '';
          fullText += token;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
          );
        }

        // Salvar interpretacao completa e atualizar cache
        await saveInterpretation(readingId, fullText, mode, cacheHash);

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
        );
        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: true })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### 4.2 Cliente (EventSource)

```typescript
// Nao usar EventSource nativo (nao suporta POST)
// Usar fetch com ReadableStream

async function requestInterpretation(params: InterpretRequest) {
  const response = await fetch('/api/v1/ai/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

    for (const line of lines) {
      const data = JSON.parse(line.slice(6));
      if (data.done) break;
      if (data.error) throw new Error('AI service error');
      fullText += data.token;
      onUpdate(fullText); // Atualiza UI com texto parcial
    }
  }

  return fullText;
}
```

---

## 5. API Endpoints

### POST /api/v1/ai/interpret
**Descricao**: Gera interpretacao IA de uma tiragem (streaming).
**Headers**: `Authorization: Bearer <token>`
**Body**: `{ readingId, mode, mood?, question? }`
**Response 200**: `text/event-stream` com tokens
**Response 429**: `{ error: "AI_DAILY_LIMIT_REACHED" }`

### POST /api/v1/ai/follow-up
**Descricao**: Envia pergunta de follow-up sobre uma interpretacao (streaming).
**Body**: `{ interpretationId, message, conversationHistory? }`
**Response 200**: `text/event-stream` com tokens
**Response 429**: `{ error: "FOLLOW_UP_LIMIT_REACHED", remaining: 0 }`

### GET /api/v1/ai/usage
**Descricao**: Retorna uso diario da IA.
**Response 200**: `{ interpretations: 3, followUps: 5, dailyLimit: 10, followUpLimit: 10, resetsAt: "2025-01-02T03:00:00Z" }`

---

## 6. Database Schema

```prisma
model Interpretation {
  id               String   @id @default(cuid())
  readingId        String
  mode             String   // "general" | "love" | "career" | "yesno"
  mood             String?
  question         String?
  content          String   @db.Text
  cacheHash        String   @unique
  modelVersion     String   @default("gpt-4o-2024-08-06")
  tokensUsed       Int
  wasCached        Boolean  @default(false)
  createdAt        DateTime @default(now())

  reading          Reading  @relation(fields: [readingId], references: [id], onDelete: Cascade)
  followUpMessages FollowUpMessage[]

  @@index([cacheHash])
  @@index([readingId])
  @@map("interpretations")
}

model FollowUpMessage {
  id               String   @id @default(cuid())
  interpretationId String
  role             String   // "user" | "assistant"
  content          String   @db.Text
  createdAt        DateTime @default(now())

  interpretation   Interpretation @relation(fields: [interpretationId], references: [id], onDelete: Cascade)

  @@map("follow_up_messages")
}

model AIDailyUsage {
  id               String   @id @default(cuid())
  userId           String
  date             DateTime // data truncada (sem hora, BRT)
  interpretationCount Int   @default(0)
  followUpCount    Int      @default(0)

  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@map("ai_daily_usage")
}
```

---

## 7. Gerenciamento de Tokens

### Estimativa de Tokens por Operacao
| Operacao | Tokens de Input (est.) | Tokens de Output (est.) | Total |
|---|---|---|---|
| Interpretacao 1 carta | 500 | 400 | 900 |
| Interpretacao 3 cartas | 800 | 800 | 1.600 |
| Interpretacao 10 cartas | 2.000 | 1.500 | 3.500 |
| Follow-up | 1.500 | 400 | 1.900 |

### Controle de Custos
- Max tokens output por interpretacao: 2.000 (seguranca)
- Temperatura: 0.8 (balance entre criatividade e coerencia)
- Top-p: 0.95
- Presence penalty: 0.1 (evitar repeticao)
- Frequency penalty: 0.1
- Cache de interpretacoes identicas reduz chamadas em ~30% (estimativa)

---

## 8. Rotas da Aplicacao

A funcionalidade de IA NAO possui paginas dedicadas. E integrada na pagina de sessao de leitura (`/tirar/sessao`) como componentes condicionais.

| Componente | Localizacao | Condicao |
|---|---|---|
| InterpretationRequest | /tirar/sessao | Apos revelacao das cartas |
| StreamingInterpretation | /tirar/sessao | Apos solicitar interpretacao |
| FollowUpChat | /tirar/sessao | Apos completar interpretacao |
| AIUsageIndicator | Navbar, /tirar, /tirar/sessao | Sempre visivel para usuarios logados |