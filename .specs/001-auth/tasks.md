# SPEC-001: Sistema de Autenticacao e Autorizacao -- Tarefas

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## Tarefas de Implementacao

### Configuracao e Infraestrutura

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 1 | Instalar e configurar Auth.js v5 (`next-auth@5.0.0-beta.32`, ADR-010) com adapter Prisma mínimo | pending | 2 | - |
| 2 | Configurar Google OAuth no Google Cloud Console e obter credentials | pending | 1 | - |
| 3 | Configurar provedor de email (Resend) com template transacional | pending | 2 | - |
| 4 | Criar schema Prisma para User, Session, VerificationToken | pending | 2 | 1 |
| 5 | Executar migracao inicial do banco de dados | pending | 0.5 | 4 |

### Backend - API Routes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 6 | Implementar POST /api/v1/auth/register com validacao Zod | pending | 3 | 4, 5 |
| 7 | Implementar POST /api/v1/auth/login com hashing bcrypt | pending | 3 | 4, 5 |
| 8 | Configurar Google/Facebook OAuth via Auth.js (/api/auth/*, adapter mínimo) + emissao de tokens custom no callback | pending | 3 | 1, 2 |
| 9 | Implementar POST /api/v1/auth/magic-link (geracao e envio) | pending | 2 | 3, 4 |
| 10 | Implementar POST /api/v1/auth/magic-link/verify (single-use, 15 min) | pending | 2 | 9 |
| 11 | Implementar POST /api/v1/auth/forgot-password | pending | 2 | 3, 4 |
| 12 | Implementar POST /api/v1/auth/reset-password | pending | 2 | 11 |
| 13 | Implementar POST /api/v1/auth/refresh (renovacao com rotacao + deteccao de reuso por familia) | pending | 3 | 7 |
| 14 | Implementar POST /api/v1/auth/logout (revogacao de sessao) | pending | 1 | 13 |
| 15 | Implementar DELETE /api/v1/auth/account (soft delete LGPD com confirmacao digitada) | pending | 2 | 4 |
| 16 | Implementar job agendado de hard delete/anonymizacao apos 30 dias (RF-AUTH-008) | pending | 3 | 15 |
| 17 | Implementar endpoint de restauracao de conta dentro da janela de carencia LGPD | pending | 1.5 | 15 |

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
| 27 | Implementar rate limiting com memoria em servidor | pending | 2 | 7 |
| 28 | Criar testes E2E de fluxo completo de autenticacao | pending | 4 | 19-24 |
| 29 | Criar testes de integracao para todos os endpoints | pending | 3 | 6-17 |

---

## Resumo

| Categoria | Total de Tarefas | Horas Estimadas |
|---|---|---|
| Configuracao e Infraestrutura | 5 | 7.5h |
| Backend - API Routes | 12 | 27h |
| Frontend - Componentes e Paginas | 7 | 15.5h |
| Estado e Integracao | 5 | 14h |
| **TOTAL** | **29** | **64h** |

---

## Ordem Recomendada de Execucao

1. Tarefas 1-5 (infraestrutura)
2. Tarefas 6-7 (cadastro e login basicos)
3. Tarefa 25 (AuthStore)
4. Tarefas 18-20 (AuthLayout + LoginForm + RegisterForm)
5. Tarefa 8 (OAuth via NextAuth)
6. Tarefas 9-10 (Magic Link)
7. Tarefas 11-12 (Recuperacao de senha)
8. Tarefa 13 (Refresh token com rotacao)
9. Tarefa 24 (AuthGuard)
10. Tarefas 21-23 (formularios restantes)
11. Tarefas 14-15 (logout e delecao)
12. Tarefas 16-17 (hard delete e restauracao LGPD)
13. Tarefa 26 (interceptor)
14. Tarefa 27 (rate limiting)
15. Tarefas 28-29 (testes)