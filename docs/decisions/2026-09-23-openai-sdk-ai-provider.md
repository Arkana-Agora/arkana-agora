# ADR-012: openai SDK como único cliente de IA (GPT-4o / GPT-4o-mini)

### Status
**Aceito** ✅ — padronização do stack de IA do MVP; substitui a menção histórica a `z-ai-web-dev-sdk` (nunca instalado neste repositório) como verdade corrente.

### Contexto

O plano original (Sprint 1, S4) previa `z-ai-web-dev-sdk` como abstração de provedores de IA. O pacote **não existe** no `package.json`/lockfile deste projeto; a implementação entregue usou o SDK oficial `openai@^7.21.0` com contrato próprio `AIClient` (`src/lib/ai/client.ts`) e DI via `setAIClient`/`resetAIClient`.

A documentação viva (README, `docs/05-ai/*`, `docs/architecture.md`, requirements de SPEC-004/005/006) ainda descrevia `z-ai-web-dev-sdk` e env vars `AI_PRIMARY_API_KEY`/`AI_FALLBACK_API_KEY` que **nenhum código lê**. O env real é `AI_API_KEY`, e o modelo estava hardcoded `"gpt-4o"` nos três routes de streaming.

Pergunta de produto: qual modelo usar para tarot/divinações — qualidade ou velocidade?

### Decisão

1. **`openai` é o único SDK de IA** do repositório. Não reintroduzir `z-ai-web-dev-sdk`.
2. **Env contract** (espelhado em `.env.example` e `docs/02-architecture/deployment.md`):
   - `AI_API_KEY` — chave OpenAI (obrigatória em runtime).
   - `AI_MODEL` — modelo de **interpretações completas** (default `gpt-4o`).
   - `AI_MODEL_FOLLOWUP` — modelo de **follow-ups conversacionais** (default `gpt-4o-mini`).
3. **Roteamento por feature** em `src/lib/ai/models.ts`:
   - `getInterpretationModel()` → `POST /ai/interpret` e `/ai/arcana-interpret` (profundidade esotérica pt-BR, saídas longas) → **GPT-4o**.
   - `getFollowUpModel()` → `POST /ai/follow-up` (turnos curtos, latência/custo) → **GPT-4o-mini**.
4. Justificativa do split: GPT-4o maximiza qualidade de interpretação (o produto é a leitura); GPT-4o-mini é ~10× mais barato e com TTFT menor para diálogo — alinhado à matriz de trade-offs já documentada em `docs/05-ai/providers.md`.

### Consequências

**Positivas:**
- Um SDK, um lockfile, um contrato de testes (`AIClient` mockável).
- Modelos configuráveis sem rede/deploys de código (só env).
- Docs vivas e código convergem; notas históricas de desvio permanecem nos planos de execução.

**Negativas / riscos:**
- Sem fallback automático de modelo em rate-limit (cadeia primário→mini→cache genérica permanece como roadmap, não implementada neste ADR).
- `MODEL_VERSION` em `Interpretation` (`gpt-4o-2024-08-06`) é o default de persistência; se `AI_MODEL` mudar em prod, o snapshot pode divergir do modelo real da chamada (mitigação futura: gravar o modelo usado na criação).

### Alternativas Consideradas

| Alternativa | Por que não escolhida |
|---|---|
| Manter menções a `z-ai-web-dev-sdk` como atual | Pacote inexistente; docs mentem sobre o runtime |
| Um único modelo `gpt-4o` para tudo | Follow-ups pagam latência/custo sem ganho de qualidade proporcional |
| Um único modelo `gpt-4o-mini` para tudo | Interpretações longas de tarot perdem profundidade esotérica pt-BR |
| Multi-provider router (Gemini/Claude) agora | Fora do escopo MVP; `AIClient` já isola a troca futura |
