# Provedores de IA — arkana-agora

> **SDK**: openai (`openai@^7`) | **Primário**: OpenAI GPT-4o | **Porta**: 3000 (web) + 3003 (WebSocket)

## Sumário

- [Visão Geral](#visão-geral)
- [Provedor Primário](#provedor-primário)
- [Provedor Fallback](#provedor-fallback)
- [Provedores Futuros](#provedores-futuros)
- [Critérios de Seleção](#critérios-de-seleção)
- [Configuração](#configuração)
- [Feature Flags](#feature-flags)
- [Monitoramento](#monitoramento)
- [Gateway e Infraestrutura](#gateway-e-infraestrutura)

---

## Visão Geral

### Arquitetura Multi-Provider

```
                     ┌──────────────────┐
                     │   Model Router   │
                     │ (feature → model)│
                     └────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
     ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
     │   OpenAI    │ │   Gemini    │ │   Claude    │
     │   GPT-4o    │ │    Pro      │ │     3       │
     │  (primário)  │ │  (futuro)   │ │  (futuro)   │
     └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
            │               │               │
            └───────────────┴───────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                    │   OpenAI    │
                    │  (SDK oficial)│
                    └─────────────┘
```

### Status dos Provedores

| Provedor | Modelo | Status | Uso | Prioridade |
----------|--------|--------|-----|------------|
| OpenAI | GPT-4o | ✅ Selecionado (planejado) | Leituras, chat, arcanos | 1 (primário) |
| OpenAI | GPT-4o-mini | ✅ Selecionado (planejado) | Horóscopos, respostas rápidas | 2 (fallback) |
| Google | Gemini Pro | 🔮 Futuro | A/B testing | 3 |
| Anthropic | Claude 3.5 Sonnet | 🔮 Futuro | Backup de alta qualidade | 4 |
| Custom | Fine-tuned GPT-4o | 🔄 Roadmap | Leitura especializada pt-BR | 5 |

---

## Provedor Primário

### OpenAI GPT-4o

| Atributo | Detalhe |
----------|--------|
| **Modelo** | `gpt-4o` |
| **Context Window** | 128K tokens |
| **Max Output** | 4.096 tokens (configurável até 16K) |
| **Latência média** | 3–5s (primeiro token: ~800ms) |
| **Suporte pt-BR** | Excelente |
| **Streaming** | Sim (SSE nativo) |
| **Rate Limit** | 500 RPM, 200K TPM (Tier 1) |

### Por que GPT-4o?

| Critério | Nota (1-5) | Justificativa |
----------|------------|-------------|
| Qualidade pt-BR | 5 | Melhor modelo para português brasileiro com contexto esotérico |
| Latência | 4 | Streaming rápido, boa experiência de UX |
| Custo | 3 | Mais caro que alternativas, mas qualidade compensa |
| Confiabilidade | 5 | SLA de 99,9%, raramente indisponível |
| Ecossistema | 5 | Melhor SDK, documentação, comunidade |

### Configuração via openai SDK

```typescript
// src/lib/ai/client.ts

import OpenAI from 'openai'

export function getAIClient(): AIClient {
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) throw new Error('AI_API_KEY environment variable is required')
  return new OpenAI({ apiKey }) as AIClient
}

// Modelos: AI_MODEL (interpretacoes) e AI_MODEL_FOLLOWUP (follow-ups)
// src/lib/ai/models.ts → getInterpretationModel() / getFollowUpModel()
```

---

## Provedor Fallback

### OpenAI GPT-4o-mini

| Atributo | Detalhe |
----------|--------|
| **Modelo** | `gpt-4o-mini` |
| **Context Window** | 128K tokens |
| **Max Output** | 2.048 tokens |
| **Latência média** | 1–2s (primeiro token: ~400ms) |
| **Suporte pt-BR** | Bom |
| **Streaming** | Sim |
| **Custo relativo** | ~10% do GPT-4o |

### Quando é usado

| Cenário | Modelo | Razão |
---------|--------|-------|
| Horóscopo diário | GPT-4o-mini | Tarefa simples, custo baixo |
| Resposta Sim/Não | GPT-4o-mini | Resposta curta e objetiva |
| Fallback do GPT-4o | GPT-4o-mini | Disponibilidade > qualidade |
| Rate limit do GPT-4o | GPT-4o-mini | Continuidade do serviço |

### Trade-offs

| Aspecto | GPT-4o | GPT-4o-mini |
--------|--------|-------------|
| Profundidade interpretativa | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Empatia e tom | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Conhecimento de tarot | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Velocidade | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Custo | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## Provedores Futuros

### Google Gemini Pro

| Atributo | Detalhe esperado |
----------|-----------------|
| **Context Window** | 1M+ tokens |
| **Vantagem** | Janela enorme, bom custo |
| **Desafio** | Qualidade pt-BR para contexto esotérico ainda incerta |
| **Timeline** | Q3 2025 (avaliação) |

### Anthropic Claude 3.5 Sonnet

| Atributo | Detalhe esperado |
----------|-----------------|
| **Context Window** | 200K tokens |
| **Vantagem** | Alta qualidade, bom seguimento de instruções |
| **Desafio** | Custo, disponibilidade na região, suporte pt-BR |
| **Timeline** | Q4 2025 (avaliação) |

### Fine-tuned GPT-4o

| Atributo | Detalhe esperado |
----------|-----------------|
| **Dataset** | 10K+ leituras de qualidade validadas por tarólogos humanos |
| **Vantagem** | Especialização total em tarot pt-BR, estilo consistente |
| **Desafio** | Custo de fine-tuning ($$$), manutenção do dataset |
| **Timeline** | Q2 2025 (coleta de dados), Q3 2025 (treinamento) |

> **Estratégia**: Coletar leituras com feedback positivo dos usuários (⭐⭐⭐⭐⭐) como dataset de treino.

---

## Critérios de Seleção

### Matriz de Decisão

| Critério | Peso | GPT-4o | GPT-4o-mini | Gemini Pro | Claude 3.5 |
----------|------|--------|-------------|-----------|----------|
| Qualidade pt-BR | 30% | 9.5 | 7.5 | 8.0 | 8.5 |
| Custo | 25% | 6.0 | 9.5 | 8.5 | 5.0 |
| Latência | 20% | 8.0 | 9.0 | 8.5 | 8.0 |
| Confiabilidade | 15% | 9.5 | 9.5 | 8.0 | 9.0 |
| Suporte streaming | 10% | 10.0 | 10.0 | 9.0 | 9.0 |
| **Score ponderado** | | **8.3** | **8.8** | **8.3** | **7.7** |

### Especificidades para pt-BR

O provedor deve atender:

1. **Naturalidade**: Respostas que soem como português brasileiro coloquial, não traduzido
2. **Cultura**: Compreensão de referências culturais brasileiras
3. **Terminologia esotérica**: Conhecimento de termos como "arcanos", "naipe", "invertida", "espalhamento"
4. **Tom empático**: Capacidade de manter tom acolhedor sem ser artificial

---

## Configuração

### Variáveis de Ambiente

```env
# ===== AI (openai SDK — src/lib/ai/client.ts) =====

AI_API_KEY=sk-proj-abc123...
# Modelo para interpretacoes completas (tarot/arcano)
AI_MODEL=gpt-4o
# Modelo para follow-ups conversacionais (mais rapido/economico)
AI_MODEL_FOLLOWUP=gpt-4o-mini

# Configurações gerais
AI_DEFAULT_TEMPERATURE=0.7
AI_MAX_TOKENS=4096
AI_REQUEST_TIMEOUT_MS=30000
AI_STREAM_TIMEOUT_MS=60000

# Rate limiting
AI_FREE_DAILY_LIMIT=10
AI_FREE_MONTHLY_CHAT_LIMIT=50

# Cache
AI_CACHE_ENABLED=true
AI_CACHE_TTL_SECONDS=86400
AI_CACHE_REDIS_URL=redis://localhost:6379
```

### Configuração dos modelos (env)

```env
AI_API_KEY=...
AI_MODEL=gpt-4o
AI_MODEL_FOLLOWUP=gpt-4o-mini
```

A seleção de modelo por feature é feita em `src/lib/ai/models.ts`:

| Feature | Helper | Default | Razão |
|---------|--------|---------|-------|
| Interpretação de tiragem / arcano | `getInterpretationModel()` | `gpt-4o` | Qualidade esotérica pt-BR |
| Follow-up conversacional | `getFollowUpModel()` | `gpt-4o-mini` | Latência e custo |
| Horóscopo (futuro) | `getFollowUpModel()` | `gpt-4o-mini` | Tarefa simples |

---

## Feature Flags

### Flags por Modelo

```typescript
// src/lib/ai/feature-flags.ts

interface FeatureFlag {
  key: string
  description: string
  enabled: boolean
  config: Record<string, unknown>
}

const AI_FEATURE_FLAGS: FeatureFlag[] = [
  {
    key: 'ai.use_mini_for_horoscope',
    description: 'Usar GPT-4o-mini para horóscopos',
    enabled: true,
    config: { model: 'gpt-4o-mini' },
  },
  {
    key: 'ai.use_mini_for_yes_no',
    description: 'Usar GPT-4o-mini para Sim/Não',
    enabled: false, // A/B testing em andamento
    config: { model: 'gpt-4o-mini', rollout: 0.2 },
  },
  {
    key: 'ai.prompt_caching',
    description: 'Habilitar prompt caching do OpenAI',
    enabled: true,
    config: { savings: '50%' },
  },
  {
    key: 'ai.gemini_experiment',
    description: 'Experimento com Gemini Pro para 5% dos usuários',
    enabled: false,
    config: { model: 'gemini-pro', rollout: 0.05 },
  },
  {
    key: 'ai.stream_optimization',
    description: 'Otimizar chunk size do streaming',
    enabled: true,
    config: { chunkSize: 'dynamic' },
  },
]
```

### A/B Testing

```
            100% das requisições
                    │
          ┌─────────┴─────────┐
          │                   │
     80% GPT-4o         20% GPT-4o-mini
     (controle)          (variante)
          │                   │
     Coleta métricas:  Coleta métricas:
     - Satisfação      - Satisfação
     - Qualidade       - Qualidade
     - Custo           - Custo
     - Latência        - Latência
          │                   │
          └─────────┬─────────┘
                    │
              Análise estatística
              Significância: p<0.05
```

---

## Monitoramento

### Métricas por Provider

| Métrica | Fonte | Alerta |
---------|-------|--------|
| Latência P50 | SDK | > 5s = warning, > 10s = critical |
| Latência P95 | SDK | > 8s = warning, > 15s = critical |
| Latência P99 | SDK | > 12s = warning, > 20s = critical |
| Error Rate | SDK | > 1% = warning, > 5% = critical |
| Tokens/min | Cost Tracker | > budget = alerta admin |
| Custo/hora | Cost Tracker | > threshold = alerta admin |
| Cache Hit Rate | Redis | < 20% = investigar |
| Timeouts | SDK | > 3/hora = investigar |

### Dashboard de Monitoramento

```
AI Provider Health — Últimas 24h
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 GPT-4o (Primário)
   Requisições:    12.345
   Latência P50:   3.2s
   Latência P95:   6.8s
   Error Rate:     0.12%
   Custo:          $45.67
   Status:         ✅ Saudável

📊 GPT-4o-mini (Fallback)
   Requisições:    3.456
   Latência P50:   1.1s
   Latência P95:   2.3s
   Error Rate:     0.05%
   Custo:          $0.89
   Status:         ✅ Saudável

💰 Custo Total (24h): $46.56
💾 Cache Hit Rate: 42%
⚠️  Fallbacks ativados: 23 (0,15%)
```

### Alertas Automatizados

| Alerta | Condição | Canal | Ação |
--------|----------|-------|------|
| Provider Down | Error rate > 10% em 5min | Slack + PagerDuty | Auto-fallback |
| Latência Alta | P95 > 15s por 10min | Slack | Investigar |
| Orçamento Diário | Custo > 80% do budget | Slack | Avisar financeiro |
| Orçamento Mensal | Custo > 90% do budget | Email + Slack | Avisar diretoria |
| Cache Down | Redis indisponível | Slack | Sem cache (custo ↑) |

---

## Gateway e Infraestrutura

### Caddy Reverse Proxy

```
                 ┌──────────────┐
                 │   Caddy      │
                 │   :443       │
                 │  (HTTPS)     │
                 └──────┬───────┘
                        │
           ┌────────────┼────────────┐
           │            │            │
           ▼            ▼            ▼
   ┌───────────┐ ┌──────────┐ ┌──────────────┐
   │ Next.js   │ │  Next.js │ │  WebSocket   │
   │  :3000    │ │  :3000   │ │  Mini-Service│
   │ (API/SSE) │ │  (SSR)   │ │  :3003       │
   └───────────┘ └──────────┘ └──────────────┘
```

### Caddyfile (resumo)

```caddyfile
arkanaagora.com.br {
    # API routes
    handle /api/* {
        reverse_proxy localhost:3000
    }

    # SSE streaming — desabilitar buffering
    handle /api/v1/ai/interpret {
        reverse_proxy localhost:3000 {
            header_up Connection ""
            flush_interval -1
        }
    }

    # WebSocket mini-service
    handle /ws/* {
        reverse_proxy localhost:3003 {
            # WebSocket upgrade
        }
    }

    # Web app (SSR)
    handle {
        reverse_proxy localhost:3000
    }
}
```

### Portas

| Serviço | Porta | Protocolo | Descrição |
---------|-------|-----------|-----------|
| Next.js (web) | 3000 | HTTP/SSE | API routes, SSR, SSE streaming |
| WebSocket | 3003 | WS | Mini-serviço para notificações em tempo real |
| Caddy | 80/443 | HTTP/HTTPS | Reverse proxy, TLS, buffering control |

### Configuração de SSE no Caddy

O Caddy precisa de configuração especial para SSE (desabilitar buffering):

```caddyfile
# Regra crítica para SSE funcionar corretamente
handle /api/v1/ai/*/stream* {
    reverse_proxy localhost:3000 {
        transport http {
            read_timeout 120s
        }
        # Flush imediato para streaming
        flush_interval -1
    }
}
```