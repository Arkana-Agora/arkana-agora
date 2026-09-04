# Checklist de Qualidade — Domínio: API

Plano: `docs/plans/20260901165326-modulo1-auth-plan.md`
Domínio: `api` — requisitos de API (rotas `/api/v1/auth/*` e `/api/auth/*`)

## Formato e contrato
- [ ] CHK-API-001 Os métodos HTTP, paths e rota de cada endpoint estão explicitamente definidos (sem colisão entre `/api/auth/*` e `/api/v1/auth/*`)? [Clarity]
- [ ] CHK-API-002 Os request bodies (campos, tipos, obrigatoriedade, regras de validação) estão especificados para cada rota? [Completeness]
- [ ] CHK-API-003 Os response bodies (status 201/200, shape do payload, meta) estão especificados e consistentes entre rotas (`/login`, `/magic-link/verify`, `/refresh` retornam accessToken no body; refresh nunca no body)? [Consistency]
- [ ] CHK-API-004 A convenção de códigos de erro `AUTH_*` (S8) é aplicada uniformemente com o mapeamento HTTP correto em todas as rotas? [Consistency]
- [ ] CHK-API-005 Os cabeçalhos de segurança (CSRF double-submit, cookie httpOnly/secure/sameSite/path, Authorization Bearer) estão especificados por rota (S4/S7, design §7.1/7.2)? [Completeness]

## Cobertura de classes de falha
- [ ] CHK-API-006 Todos os endpoints especificam tratamento para as classes de falha (validação, não-autorizado, conflito, expirado, rate-limit)? [Coverage]
- [ ] CHK-API-007 Os endpoints somente-Bearer vs somente-cookie estão corretamente rotulados (para aplicabilidade de CSRF)? [Coverage]

## Comportamento e estados
- [x] CHK-API-008 A anti-enumeração (resposta 200 idêntica para email existente/não, em magic-link e forgot-password) está expressa como requisito, não só comentário? [Edge Case]
- [ ] CHK-API-009 A rotação + detecção de reuso do refresh (revoga família) está especificada como comportamento observável da API? [Edge Case]
- [ ] CHK-API-010 A semântica do magic link single-use (token já usado → inválido) e expirado (→ 410) está separada e testável? [Edge Case]

## Dependências e assunções
- [ ] CHK-API-011 As assunções de infra (Redis p/ tokenVersion/rate-limit, cron, Resend) estão explícitas como dependências de API, não implícitas? [Gap]
- [ ] CHK-API-012 As tarefas listam o path do arquivo de rota (`src/app/api/v1/auth/.../route.ts`) para cada endpoint? [Completeness]
