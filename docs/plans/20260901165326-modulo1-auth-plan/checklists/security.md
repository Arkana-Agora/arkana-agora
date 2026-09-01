# Checklist de Qualidade — Domínio: Security

Plano: `docs/plans/20260901165326-modulo1-auth-plan.md`
Domínio: `security` — requisitos de segurança

## Autenticação e tokens
- [ ] CHK-SEC-001 O requisito de hash de senha bcrypt custo 12 é explícito em todas as rotas que gravam senha (register, reset-password)? [Clarity]
- [ ] CHK-SEC-002 O refresh token está especificado para trafegar **somente** em cookie httpOnly/secure/sameSite=strict/path (nunca body/query) — e o access no header Bearer? [Completeness]
- [ ] CHK-SEC-003 O requisito de armazenar o refresh token como **hash SHA-256** (nunca texto plano) está explícito no schema/Modelo/token-service? [Completeness]
- [ ] CHK-SEC-004 A claim `tokenVersion` validada contra Redis a cada request, com bump em role/plan/suspensão/logout-all, está especificada? [Completeness]
- [ ] CHK-SEC-005 A senha/refresh nunca aparece em logs ou responses — o requisito de redaction está presente? [Completeness]

## Prevenção de abuso
- [ ] CHK-SEC-006 Os limites de rate limiting por rota estão definidos (login 5/15min, cadastro 3/IP/h, magic-link 3/h, reset 3/h, verify-email 1/min) com status 429? [Measurability]
- [ ] CHK-SEC-007 O lockout por tentativas falhas de login (5 → 15min, ADMIN 20) está especificado com `retryAfter`? [Measurability]
- [ ] CHK-SEC-008 Os endpoints somente-Bearer vs cookie têm a decisão de CSRF (double-submit nas rotas com cookie) especificada? [Completeness]

## Anti-enumeração e LGPD
- [ ] CHK-SEC-009 A anti-enumeração (resposta idêntica) está especificada para magic-link, forgot-password e delete-account? [Edge Case]
- [ ] CHK-SEC-010 A re-checagem `isActive = true AND deletedAt IS NULL` em rotas de privilégio e re-autenticação (LGPD) está especificada? [Completeness]
- [ ] CHK-SEC-011 A revalidação do usuário a cada renovação de refresh (soft-deleted não re-autentica) está especificada? [Edge Case]

## Dependências e segredos
- [ ] CHK-SEC-012 As variáveis secretas (AUTH_SECRET, chave privada RS256, RESEND, REDIS_URL, credenciais Google) estão documentadas em `.env.example` sem hardcode? [Gap]
- [ ] CHK-SEC-013 A decisão de RS256 via `jose` (Edge-compat) e a chave privada via env estão especificadas? [Completeness]
