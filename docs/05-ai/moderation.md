# Moderação de Conteúdo IA — arkana-agora

> **Prioridade**: Máxima — segurança do usuário acima de tudo
> **Conformidade**: LGPD, Marco Civil da Internet, CVV

## Sumário

- [Camadas de Moderação](#camadas-de-moderacao)
- [Conteúdo Bloqueado](#conteudo-bloqueado)
- [Keywords de Auto-flag](#keywords-de-auto-flag)
- [Redirecionamento CVV](#redirecionamento-cvv)
- [Escalonamento](#escalonamento)
- [Taxas de Falso Positivo](#taxas-de-falso-positivo)
- [Log de Moderação](#log-de-moderacao)

---

## Camadas de Moderação

A moderação atua em 4 camadas sequenciais:

```
┌───────────────────────────────────────────────────────────┐
│                  CAMADAS DE MODERAÇÃO                      │
│                                                           │
│  Camada 1: System Prompt Rules                            │
│  ├── Regras injetadas no prompt base                      │
│  ├── Instruções incondicionais de segurança               │
│  └── Instruções de redirecionamento CVV                   │
│                                                           │
│  Camada 2: Input Filter (Pré-IA)                          │
│  ├── Verificação de keywords no input do usuário          │
│  ├── Classificação de gravidade                           │
│  └── Bloqueio antes de enviar à IA                        │
│                                                           │
│  Camada 3: Output Filter (Pós-IA)                         │
│  ├── Verificação da resposta gerada                       │
│  ├── Detecção de内容 que vazou pelas regras              │
│  └── Substituição ou bloqueio da resposta                 │
│                                                           │
│  Camada 4: User Reports (Pós-interação)                  │
│  ├── Denúncia manual de usuários                          │
│  ├── Fila de revisão humana                               │
│  └── Decisão final do admin                               │
└───────────────────────────────────────────────────────────┘
```

### Fluxo Detalhado

```
Input do Usuário
      │
      ▼
┌─────────────┐
│  Input      │──── Flag alto ────> CVV Redirect (bloqueia)
│  Filter     │
└──────┬──────┘
       │ OK
       ▼
┌─────────────┐
│  System     │──── IA segue regras
│  Prompt     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  GPT-4o     │
│  Geração    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Output     │──── Flag ────> Reescrever ou bloquear
│  Filter     │
└──────┬──────┘
       │ OK
       ▼
   Usuário
       │
       ▼
┌─────────────┐
│  User       │──── Denúncia ────> Fila de revisão humana
│  Reports    │
└─────────────┘
```

---

## Conteúdo Bloqueado

### Categorias e Ações

| Categoria | Gravidade | Ação | Exemplo |
|-----------|-----------|------|---------|
| Auto-harm / Suicídio | **Crítica** | Bloqueio + CVV redirect | "quero me machucar", "não quero mais viver" |
| Violência / Abuso | **Alta** | Bloqueio + disque 180 | "meu parceiro me bate" |
| Discurso de ódio | **Alta** | Bloqueio + flag admin | conteúdo discriminatório |
| Conselho médico | **Média** | Advertência no output | "o tarot diz que estou doente" |
| Conselho jurídico | **Média** | Advertência no output | "devo processar meu ex?" |
| Conteúdo sexual explícito | **Alta** | Bloqueio | pedofilia, exploração |
| Promoção de substâncias | **Média** | Filtro no output | drogas, automedicação |

### Detalhamento por Categoria

#### Auto-harm (Crítica — Prioridade Máxima)

**Triggers**: qualquer menção a suicídio, automutilação, vontade de morrer, desespero profundo.

**Ação**:
1. Interrompe imediatamente o fluxo de IA
2. Não envia resposta da IA
3. Retorna mensagem de redirecionamento ao CVV
4. Registra log com nível `critical`
5. Dispara notificação interna ao time de moderação

#### Discurso de Ódio (Alta)

**Triggers**: termos racistas, homofóbicos, transfóbicos, misóginos, xenofóbicos.

**Ação**:
1. Bloqueia a requisição
2. Retorna erro: `CONTENT_BLOCKED`
3. Registra log com nível `high`
4. Após 3 ocorrências → notificação admin

---

## Keywords de Auto-flag

### Lista de Termos (input filter)

> **Nota**: Termos são verificados em contextos de gravidade, não apenas por presença. Contexto é analisado antes do bloqueio.

#### Categoria: Auto-harm

| Termo / Padrão | Gravidade | Ação |
|----------------|-----------|------|
| `suicídio`, `suicida` | Crítica | CVV redirect |
| `me machucar` | Crítica | CVV redirect |
| `não quero viver` | Crítica | CVV redirect |
| `matar` + `mim` | Crítica | CVV redirect |
| `cortar` + `braço`/`pulso` | Crítica | CVV redirect |
| `fim da vida` | Alta | CVV redirect + análise de contexto |
| `desaparecer` + `para sempre` | Média | Análise de contexto |

#### Categoria: Violência

| Termo / Padrão | Gravidade | Ação |
|----------------|-----------|------|
| `me bate` / `me agrediu` | Alta | Disque 180 + bloqueio |
| `abuso` + `doméstico` | Alta | Disque 180 + bloqueio |
| `violência` + `física` | Alta | Bloqueio + flag |
| `ameaçou` + `matar` | Crítica | Polícia 190 + bloqueio |

#### Categoria: Discurso de Ódio

| Termo / Padrão | Gravidade | Ação |
|----------------|-----------|------|
| Termos racistas conhecidos | Alta | Bloqueio + flag admin |
| Termos homofóbicos/transfóbicos | Alta | Bloqueio + flag admin |
| Generalizações preconceituosas | Média | Filtro + aviso |

### Implementação

```typescript
// src/lib/ai/moderation/keyword-filter.ts

interface ModerationResult {
  safe: boolean
  category?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  action?: 'block' | 'warn' | 'cvv_redirect' | 'flag'
  matchedTerms?: string[]
}

const CRITICAL_PATTERNS: ModerationRule[] = [
  {
    pattern: /suicídio|suicida/i,
    category: 'self_harm',
    severity: 'critical',
    action: 'cvv_redirect',
  },
  {
    pattern: /me (machucar|ferir|cortar)/i,
    category: 'self_harm',
    severity: 'critical',
    action: 'cvv_redirect',
  },
  // ... mais padrões
]

export async function filterInput(
  text: string
): Promise<ModerationResult> {
  for (const rule of CRITICAL_PATTERNS) {
    if (rule.pattern.test(text)) {
      return {
        safe: false,
        category: rule.category,
        severity: rule.severity,
        action: rule.action,
        matchedTerms: text.match(rule.pattern) || undefined,
      }
    }
  }

  return { safe: true }
}
```

---

## Redirecionamento CVV

### Quando acionar

- Qualquer menção de auto-harm (categoria crítica)
- Score de risco do input filter > 0.85
- Detecção no output da IA (fallback)

### Mensagem padrão

```json
{
  "type": "cvv_redirect",
  "title": "Sua saúde importa",
  "message": "Percebo que você está passando por um momento muito difícil. Quero que saiba que não está sozinho(a). Existem pessoas preparadas e dispostas a te ouvir, gratuitamente, a qualquer hora.",
  "resources": [
    {
      "name": "CVV — Ligue 188",
      "description": "Atendimento 24 horas, gratuito e confidencial",
      "phone": "188",
      "url": "https://www.cvv.org.br"
    },
    {
      "name": "Chat CVV",
      "description": "Converse com um voluntário pelo chat",
      "url": "https://www.cvv.org.br/chat"
    },
    {
      "name": "SAMU",
      "description": "Emergências de saúde",
      "phone": "192"
    }
  ],
  "footer": "O tarot é uma ferramenta de autoconhecimento, mas o cuidado com a sua vida vem primeiro. 💙"
}
```

### Comportamento técnico

1. A requisição para a IA **não é enviada** (economiza custo e evita respostas impróprias)
2. A resposta CVV é cacheada por 1 hora para o mesmo usuário
3. Log com nível `critical` é criado imediatamente
4. Notificação Slack/Email para time de moderação

---

## Escalonamento

### Fluxo de Decisão

```
Auto-flag (Input/Output)
       │
       ▼
┌──────────────────────┐
│  Classificação       │
│  - severity          │
│  - category          │
│  - confidence        │
└──────┬───────────────┘
       │
       ├─ Critical ────> CVV redirect + alerta imediato
       │
       ├─ High ────────> Fila prioritária de revisão humana
       │                   SLA: 2 horas
       │
       ├─ Medium ──────> Fila normal de revisão
       │                   SLA: 24 horas
       │
       └─ Low ─────────> Log apenas (sem intervenção)
                           Revisão semanal
```

### Fila de Revisão Humana

| SLA | Severidade | Ações possíveis |
|-----|-----------|-----------------|
| 2h | Critical / High | Revisão imediata, possível suspensão do conteúdo |
| 24h | Medium | Revisão, possível aviso ao usuário |
| 7d | Low | Revisão em lote, ajuste de filtros |

---

## Taxas de Falso Positivo

### Monitoramento

| Métrica | Meta | Alerta |
|---------|------|--------|
| Falso positivo (input) | < 2% | > 5% = ajustar filtros |
| Falso negativo (output) | < 0.5% | > 1% = revisar regras |
| Falso positivo CVV redirect | < 0.1% | > 0.5% = revisar padrões |

### Ajuste Contínuo

1. **Semanalmente**: Revisar logs de moderação
2. **Mensalmente**: Ajustar keywords com base em falsos positivos/negativos
3. **Trimestralmente**: Revisão completa das regras com equipe multidisciplinar
4. **Feedback loop**: Usuários podem contestar bloqueios (envia para revisão)

### Métricas Dashboard

```
Moderação — Últimos 30 dias
━━━━━━━━━━━━━━━━━━━━━━━━
Total verificados:     45.678
Bloqueados (auto):     234 (0,51%)
CVV redirects:          12 (0,03%)
Flags para revisão:    89
Resolvidos:             89
  • Procedentes:        45
  • Improcedentes:      44 (falsos positivos: 0,10%)
Tempo médio resolução: 4,2h
```

---

## Log de Moderação

### Estrutura do Log

```prisma
model ModerationLog {
  id            String   @id()
  userId        String?
  readingId     String?

  // O que foi verificado
  inputText     String?
  outputText    String?

  // Resultado
  safe          Boolean
  category      String?  // self_harm, violence, hate_speech, medical, etc.
  severity      String?  // low, medium, high, critical
  action        String?  // block, warn, cvv_redirect, flag

  // Detalhes
  matchedTerms  String[] // termos que dispararam o filtro
  confidence    Float?   // confiança da detecção (0-1)
  filterLayer   String   // system_prompt, input_filter, output_filter, user_report

  // Meta
  ipAddress     String?
  userAgent     String?
  createdAt     DateTime @default(now())

  user          User?    @relation(fields: [userId], references: [id])
}
```

### Retenção

| Tipo | Retenção | Justificativa |
|------|----------|---------------|
| Logs de moderação | 2 anos | Auditoria e conformidade LGPD |
| Conteúdo bloqueado | Até resolução + 30 dias | Revisão de recurso |
| Conteúdo de CVV redirect | 90 dias pós resolução | Follow-up necessário |

### Consulta de Logs (Admin)

Disponível em `GET /admin/reports` com filtros:

- Por período
- Por severidade
- Por categoria
- Por usuário
- Por status de resolução