# SPEC-001: Sistema de Autenticacao e Autorizacao -- Tarefas

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## Tarefas de Implementacao

### Configuracao e Infraestrutura

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 1 | Instalar e configurar Auth.js v5 (`next-auth@5.0.0-beta.32`, ADR-010) com adapter Prisma mínimo | done | 2 | - |
| 2 | Configurar Google OAuth no Google Cloud Console e obter credentials | done | 1 | - |
| 3 | Configurar provedor de email (Resend) com template transacional | done | 2 | - |
| 4 | Criar schema Prisma para User, Session, VerificationToken | done | 2 | 1 |
| 5 | Executar migracao inicial do banco de dados | done | 0.5 | 4 |

### Backend - API Routes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 6 | Implementar POST /api/v1/auth/register com validacao Zod | done | 3 | 4, 5 |
| 7 | Implementar POST /api/v1/auth/login com hashing bcrypt | done | 3 | 4, 5 |
| 8 | Configurar Google/Facebook OAuth via Auth.js (/api/auth/*, adapter mínimo) + emissao de tokens custom no callback | done | 3 | 1, 2 |
| 9 | Implementar POST /api/v1/auth/magic-link (geracao e envio) | done | 2 | 3, 4 |
| 10 | Implementar POST /api/v1/auth/magic-link/verify (single-use, 15 min) | done | 2 | 9 |
| 11 | Implementar POST /api/v1/auth/forgot-password | done | 2 | 3, 4 |
| 12 | Implementar POST /api/v1/auth/reset-password | done | 2 | 11 |
| 13 | Implementar POST /api/v1/auth/refresh (renovacao com rotacao + deteccao de reuso por familia) | done | 3 | 7 |
| 14 | Implementar POST /api/v1/auth/logout (revogacao de sessao) | done | 1 | 13 |
| 15 | Implementar DELETE /api/v1/auth/account (soft delete LGPD com confirmacao digitada) | done | 2 | 4 |
| 16 | Implementar job agendado de hard delete/anonymizacao apos 30 dias (RF-AUTH-008) | pending | 3 | 15 |
| 17 | Implementar endpoint de restauracao de conta dentro da janela de carencia LGPD | pending | 1.5 | 15 |
| 35 | Implementar POST /api/v1/auth/verify-email (consumo + reenvio do token de verificacao, RF-AUTH-005) — task extra T30 do plano | done | 2 | 6 |

### Backend - Security & Tokens (novas tasks do plano)

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 30 | Implementar Custom JWT Layer: emitir Access Token RS256 (15 min) e integrar com Auth.js callbacks | pending | 6 | 1, 4 |
| 31 | Persistir Refresh Tokens (hash SHA-256) e implementar rotacao (familyId) | pending | 4 | 13, 4 |
| 32 | Detectar reuso de refresh token e revogar toda a familia de tokens (revoke on theft) | pending | 3 | 31 |
| 33 | Implementar blacklist / token revocation store (Redis) e endpoints de revogacao total (logout all devices) | pending | 3 | 31, 14 |
| 34 | Implementar middleware de validação de access token (RS256) e refresh workflow em edge/runtime compatível | pending | 3.5 | 30, 31 |

### Frontend - Componentes e Paginas

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 18 | Criar componente AuthLayout com design responsivo | pending | 2 | - |
| 19 | Criar componente LoginForm com validacao client-side | pending | 3 | 7, 8, 18 |
| 20 | Criar componente RegisterForm com indicador de forca de senha | pending | 3 | 6, 18 |
| 21 | Criar componente MagicLinkForm com feedback visual | pending | 2 | 9, 18 |
| 22 | Criar componente ForgotPasswordForm | pending | 1.5 | 11, 18 |
| 23 | Criar componente ResetPasswordForm | pending | 2 | 12, 18 |
| 24 | Criar componente AuthGuard (roteamento protegido) | pending | 2 | 13 |

### Estado e Integracao

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 25 | Implementar AuthStore no Zustand com persistencia | pending | 3 | 7, 8 |
| 26 | Configurar interceptor de token (Axios middleware) | pending | 2 | 13, 25 |
| 27 | Implementar rate limiting (Redis) por IP/email (login, magic link, reset) | pending | 3 | infra |
| 28 | Criar testes E2E de fluxo completo de autenticacao | pending | 4 | 19-24 |
| 29 | Criar testes de integracao para todos os endpoints | pending | 3 | 6-17, 30-34 |

---

## Resumo

| Categoria | Total de Tarefas | Horas Estimadas |
|---|---|---|
| Configuracao e Infraestrutura | 5 | 7.5h |
| Backend - API Routes | 15 | 34.5h |
| Backend - Security & Tokens | 5 | 19.5h |
| Frontend - Componentes e Paginas | 7 | 15.5h |
| Estado e Integracao | 5 | 15h |
| **TOTAL** | **37** | **91.5h** |

---

## Ordem Recomendada de Execucao

1. Tarefas 1-5 (infraestrutura)
2. Tarefas 6-7 (cadastro e login basicos)
3. Tarefa 30 (Custom JWT Layer) e 31 (persistencia/rotacao de refresh)
4. Tarefa 25 (AuthStore)
5. Tarefas 18-20 (AuthLayout + LoginForm + RegisterForm)
6. Tarefa 8 (OAuth via NextAuth)
7. Tarefas 9-10 (Magic Link)
8. Tarefas 11-12 (Recuperacao de senha)
9. Tarefa 13 (Refresh token com rotacao)
10. Tarefa 24 (AuthGuard)
11. Tarefas 21-23 (formularios restantes)
12. Tarefas 15-17 (deleção/restauração LGPD)
13. Tarefa 26 (interceptor)
14. Tarefa 27 (rate limiting)
15. Tarefas 28-29 (testes)
