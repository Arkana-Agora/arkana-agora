# SPEC-002: Perfil do Usuario -- Tarefas

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## Tarefas de Implementacao

### Infraestrutura e Schema

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 1 | Criar schema Prisma para Profile (com relacao 1:1 com User) | done | 1.5 | SPEC-001 (User) |
| 2 | Criar migracao e seed de dados de perfil | done | 0.5 | 1 |
| 3 | Configurar Cloudflare R2 bucket para avatares e presigned URLs | done | 2 | - |
| 4 | Instalar e configurar sharp para processamento de imagens | done | 0.5 | - |

### Backend - API Routes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 5 | Implementar GET /api/v1/users/:username/profile com filtros de privacidade | done | 3 | 1, 2 |
| 6 | Implementar GET /api/v1/users/me/profile (perfil completo) | done | 1.5 | 5 |
| 7 | Implementar PATCH /api/v1/users/me/profile com validacao Zod | done | 2.5 | 1 |
| 8 | Implementar GET /api/v1/users/check-username/:username | done | 1 | 1 |
| 9 | Implementar POST /api/v1/users/me/avatar/presign (gerar URL R2) | done | 2 | 3 |
| 10 | Implementar PATCH /api/v1/users/me/avatar/confirm (processar com sharp) | done | 2.5 | 4, 9 |
| 11 | Implementar DELETE /api/v1/users/me/avatar | done | 1 | 3 |
| 12 | Implementar PATCH /api/v1/users/me/privacy | done | 1.5 | 1 |

### Frontend - Componentes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 13 | Criar componente ProfileHeader (avatar, nome, username, bio) | done | 2.5 | 5 |
| 14 | Criar componente ProfileStats (tiragens, seguidores, seguindo) | done | 1.5 | 5 |
| 15 | Criar componente ProfileAstrology (signo, arcano, kin) | done | 2 | 5 |
| 16 | Criar componente ProfileEditForm com auto-save | done | 3 | 7 |
| 17 | Criar componente de upload de avatar com preview e drag-and-drop | done | 3 | 9, 10 |
| 18 | Criar componente PrivacySettings com toggles | done | 2 | 12 |
| 19 | Criar pagina de perfil publico /perfil/:username | done | 2 | 13, 14, 15 |
| 20 | Configurar TanStack Query hooks para perfil | done | 1.5 | 5, 6 |

> **Nota 2026-09-23 (doc-shepherd):** a task 16 foi entregue com **salvamento explícito** (botão "Salvar" + feedback "Salvo às HH:MM"), não auto-save com debounce — ver `.specs/002-profile/design.md` §1.4 e `src/components/profile/profile-edit-form.tsx`.

### Calculos Automaticos

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 21 | Implementar calculo de signo solar (funcao utilitaria) | done | 1 | - |
| 22 | Integrar calculo de arcano pessoal (reutilizar logica de SPEC-005) | done | 1.5 | 21 |
| 23 | Integrar calculo de Kin Maya (reutilizar logica de SPEC-006) | deferred | 1.5 | 21 |

### Testes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 24 | Criar testes de integracao para endpoints de perfil | done | 2 | 5-12 |
| 25 | Criar testes E2E de fluxo de edicao de perfil | done | 3 | 16, 17 |
| 26 | Criar testes de privacidade (acesso negado conforme configuracao) | done | 2 | 18 |

---

## Resumo

| Categoria | Total de Tarefas | Horas Estimadas |
|---|---|---|
| Infraestrutura e Schema | 4 | 4.5h |
| Backend - API Routes | 8 | 15.5h |
| Frontend - Componentes | 8 | 16.5h |
| Calculos Automaticos | 3 | 4h |
| Testes | 3 | 7h |
| **TOTAL** | **26** | **47h** |

---

## Ordem Recomendada de Execucao

1. Tarefas 1-4 (infraestrutura)
2. Tarefa 21 (calculo de signo - funcao pura, sem dependencias)
3. Tarefas 5-8 (APIs de leitura e edicao)
4. Tarefa 20 (TanStack Query hooks)
5. Tarefas 13-15 (componentes de exibicao)
6. Tarefa 19 (pagina de perfil publico)
7. Tarefas 9-11 (upload de avatar)
8. Tarefa 17 (componente de upload no frontend)
9. Tarefa 16 (formulario de edicao)
10. Tarefas 12, 18 (privacidade)
11. Tarefas 22-23 (integracao de calculos adicionais)
12. Tarefas 24-26 (testes)