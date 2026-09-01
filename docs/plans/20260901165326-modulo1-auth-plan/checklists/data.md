# Checklist de Qualidade — Domínio: Data

Plano: `docs/plans/20260901165326-modulo1-auth-plan.md`
Domínio: `data` — requisitos de modelo e persistência

## Schema e modelo
- [ ] CHK-DATA-001 O schema (User, Session, VerificationToken) está definido com campos, tipos, constraints e índices (S/per design §4) explícitos? [Completeness]
- [ ] CHK-DATA-002 A decisão `tokenVersion` (coluna no User como fonte + Redis cache) está refletida no schema e no token-service? [Consistency]
- [ ] CHK-DATA-003 O tipo de `emailVerified` (`DateTime?`) e a derivação booleana no store estão consistentes entre schema, API e frontend (S12)? [Consistency]
- [ ] CHK-DATA-004 Os tipos enum (`UserRole`, `UserPlan`, `AuthProvider`) e valores do `VerificationToken.type` (`EMAIL`/`PASSWORD_RESET`/`MAGIC_LINK`) estão alinhados com o schema real? [Consistency]
- [ ] CHK-DATA-005 O vínculo OAuth sem model `Account` (providerId `@@unique([provider, providerId])`) está contemplado e sem contradição? [Completeness]

## Migração
- [ ] CHK-DATA-006 O requisito de migration com a cadeia atômica (generate → drift-check → run localmente) está explícito na task de migração? [Completeness]
- [ ] CHK-DATA-007 A nova coluna `tokenVersion` e qualquer mudança de schema são rastreadas como migração (F1), sem drift com o schema já migrado? [Coverage]
- [ ] CHK-DATA-008 As consultas de soft-delete (filtro `isActive=true AND deletedAt IS NULL`) têm impacto avaliado nos índices/consultas de login/refresh? [Edge Case]

## Ciclo de vida (LGPD)
- [ ] CHK-DATA-009 O soft-delete (`deletedAt`, `isActive`) com janela de 30 dias e a restauração dentro da janela estão especificados no modelo de dados? [Completeness]
- [ ] CHK-DATA-010 O hard-delete/anonimização após 30 dias (preservando dados estatísticos) está especificado em termos de dados (o que apagar/anonimizar)? [Measurability]
- [ ] CHK-DATA-011 As relações limpadas no hard-delete (Session/UserProfile/Subscription) estão listadas explicitamente? [Completeness]

## Persistência e concorrência
- [ ] CHK-DATA-012 O requisito de persistir refresh em `Session` com hash, e a detecção de reuso por família (replacedByTokenId), está no modelo? [Edge Case]
- [ ] CHK-DATA-013 A estratégia de persistência do AuthStore (localStorage) e do Redis como cache (não fonte) está especificada sem conflito? [Consistency]
