# SPEC-001: Sistema de Autenticacao e Autorizacao -- Tarefas

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## Tarefas de Implementacao

### Configuracao e Infraestrutura

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 1 | Instalar e configurar NextAuth.js v4 com adaptador Prisma | pending | 2 | - |
| 2 | Configurar Google OAuth no Google Cloud Console e obter credentials | pending | 1 | - |
| 3 | Configurar provedor de email (Resend) com template transacional | pending | 2 | - |
| 4 | Criar schema Prisma para User, Session, VerificationToken | pending | 2 | 1 |
| 5 | Executar migracao inicial do banco de dados | pending | 0.5 | 4 |

### Backend - API Routes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 6 | Implementar POST /api/v1/auth/register com validacao Zod | pending | 3 | 4, 5 |
| 7 | Implementar POST /api/v1/auth/login com hashing bcrypt | pending | 3 | 4, 5 |
| 8 | Implementar fluxo Google OAuth (signin + callback) | pending | 3 | 1, 2 |
| 9 | Implementar POST /api/v1/auth/magic-link (geracao e envio) | pending | 2 | 3, 4 |
| 10 | Implementar callback de magic link (validacao e autenticacao) | pending | 2 | 9 |
| 11 | Implementar POST /api/v1/auth/forgot-password | pending | 2 | 3, 4 |
| 12 | Implementar POST /api/v1/auth/reset-password | pending | 2 | 11 |
| 13 | Implementar POST /api/v1/auth/refresh (renovacao de token) | pending | 2 | 7 |
| 14 | Implementar POST /api/v1/auth/logout (revogacao de sessao) | pending | 1 | 13 |
| 15 | Implementar DELETE /api/v1/auth/account (soft delete LGPD) | pending | 2 | 4 |

### Frontend - Componentes e Paginas

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 16 | Criar componente AuthLayout com design responsivo | pending | 2 | - |
| 17 | Criar componente LoginForm com validacao client-side | pending | 3 | 7, 8, 16 |
| 18 | Criar componente RegisterForm com indicador de forca de senha | pending | 3 | 6, 16 |
| 19 | Criar componente MagicLinkForm com feedback visual | pending | 2 | 9, 16 |
| 20 | Criar componente ForgotPasswordForm | pending | 1.5 | 11, 16 |
| 21 | Criar componente ResetPasswordForm | pending | 2 | 12, 16 |
| 22 | Criar componente AuthGuard (roteamento protegido) | pending | 2 | 13 |

### Estado e Integracao

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 23 | Implementar AuthStore no Zustand com persistencia | pending | 3 | 7, 8 |
| 24 | Configurar interceptor de token (Axios middleware) | pending | 2 | 13, 23 |
| 25 | Implementar rate limiting com memoria em servidor | pending | 2 | 7 |
| 26 | Criar testes E2E de fluxo completo de autenticacao | pending | 4 | 17-22 |
| 27 | Criar testes de integracao para todos os endpoints | pending | 3 | 6-15 |

---

## Resumo

| Categoria | Total de Tarefas | Horas Estimadas |
|---|---|---|
| Configuracao e Infraestrutura | 5 | 7.5h |
| Backend - API Routes | 10 | 24h |
| Frontend - Componentes e Paginas | 7 | 15.5h |
| Estado e Integracao | 5 | 14h |
| **TOTAL** | **27** | **61h** |

---

## Ordem Recomendada de Execucao

1. Tarefas 1-5 (infraestrutura)
2. Tarefas 6-7 (cadastro e login basicos)
3. Tarefa 23 (AuthStore)
4. Tarefas 16-18 (AuthLayout + LoginForm + RegisterForm)
5. Tarefas 8 (Google OAuth)
6. Tarefas 9-10 (Magic Link)
7. Tarefas 11-12 (Recuperacao de senha)
8. Tarefa 13 (Refresh token)
9. Tarefa 22 (AuthGuard)
10. Tarefas 19-21 (formularios restantes)
11. Tarefas 14-15 (logout e delecao)
12. Tarefa 24 (interceptor)
13. Tarefa 25 (rate limiting)
14. Tarefas 26-27 (testes)