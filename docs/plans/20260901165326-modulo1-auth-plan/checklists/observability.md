# Checklist de Qualidade — Domínio: Observability

Plano: `docs/plans/20260901165326-modulo1-auth-plan.md`
Domínio: `observability` — requisitos de logs, métricas e monitoramento

## Logging
- [ ] CHK-OBS-001 Os eventos de segurança a logar estão especificados (login sucesso/falha, reset de senha com IP/userAgent, criação/exclusão de conta)? [Completeness]
- [ ] CHK-OBS-002 O requisito de NÃO logar password/refresh token (redaction via src/lib/logger.ts) está claro e consistente com a política de segurança? [Consistency]
- [ ] CHK-OBS-003 A retenção de logs de segurança (90 dias) está especificada como requisito (não assumido)? [Measurability]

## Métricas e performance
- [ ] CHK-OBS-004 A métrica de latência das operações de auth (< 500ms P95, RNF-AUTH-001) está definida com método de medição (carga leve na F7)? [Measurability]
- [ ] CHK-OBS-005 As métricas de rate-limit atingido (419/429 por rota) e de revogação/reuso de refresh têm algum indicador especificado? [Coverage]
- [ ] CHK-OBS-006 Há requisito de rastreabilidade (requestId, correlação) nas respostas de erro da API? [Completeness]

## Monitoramento e operação
- [ ] CHK-OBS-007 O job agendado de hard-delete (T16) especifica logging/observação da execução (tick do cron, quantos account processados, falhas)? [Completeness]
- [ ] CHK-OBS-008 O monitoramento do Redis (tokenVersion/rate-limit) e do provedor de email (Resend) tem pontos de observação especificados? [Coverage]
- [ ] CHK-OBS-009 Os alertas/instrumentação para eventos de segurança críticos (reuso de refresh, muitas falhas de login) estão contemplados? [Gap]
