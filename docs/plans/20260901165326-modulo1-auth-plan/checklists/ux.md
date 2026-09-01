# Checklist de Qualidade — Domínio: UX

Plano: `docs/plans/20260901165326-modulo1-auth-plan.md`
Domínio: `ux` — requisitos de experiência/interface

## Completude de estados
- [ ] CHK-UX-001 Os estados de carregamento (loading) das ações de auth estão especificados (botões de submit, skeleton do AuthGuard)? [Completeness]
- [ ] CHK-UX-002 Os estados de erro estão especificados por ação (erros inline de formulário, códigos `AUTH_*` exibidos, expiração de token)? [Completeness]
- [ ] CHK-UX-003 As páginas/componentes cobrem os caminhos: login, register, magic-link, forgot-password, reset-password, verify-email e callback? [Coverage]
- [ ] CHK-UX-004 O tratamento de token expirado/inválido no fluxo cliente (redirect, mensagem) está especificado? [Edge Case]

## Consistência e feedback
- [ ] CHK-UX-005 As mensagens ao usuário estão em pt-BR e os termos de tela ("Esqueci minha senha", "Entrar com Google", etc.) são consistentes entre telas? [Consistency]
- [ ] CHK-UX-006 O indicador de força de senha (RegisterForm) tem critérios definidos (fraca/média/forte) e uma regra objetiva de cálculo? [Measurability]
- [ ] CHK-UX-007 O feedback visual do MagicLinkForm ("verifique sua caixa de entrada") e o timer de reenvio (60s) estão especificados? [Measurability]
- [ ] CHK-UX-008 A barra de progresso de força e a validação client-side (Zod) têm regras idênticas às do servidor (S9)? [Consistency]

## Rotas e navegação
- [ ] CHK-UX-009 O mapeamento rota → componente (design §6) está presente e sem colisão (não há página frontend própria em `/auth/callback/google`)? [Consistency]
- [ ] CHK-UX-010 O AuthGuard especifica o comportamento de redirecionamento (para `/login`), expiração (tenta refresh) e erro de refresh? [Coverage]
- [ ] CHK-UX-011 O auth layout responsivo (50/50 desktop; mobile só formulário) está especificado? [Completeness]
- [ ] CHK-UX-012 As animações (Framer Motion, entrada 300ms) estão especificadas com dependência explícita (nova dep em F6)? [Clarity]
