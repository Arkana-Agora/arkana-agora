# SPEC-002: Perfil do Usuario -- Tarefas

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## Tarefas de Implementacao

### Infraestrutura e Schema

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 1 | Criar schema Prisma para Profile (com relacao 1:1 com User) | pending | 1.5 | SPEC-001 (User) |
| 2 | Criar migracao e seed de dados de perfil | pending | 0.5 | 1 |
| 3 | Configurar Cloudflare R2 bucket para avatares e presigned URLs | pending | 2 | - |
| 4 | Instalar e configurar sharp para processamento de imagens | pending | 0.5 | - |

### Backend - API Routes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 5 | Implementar GET /api/v1/users/:username/profile com filtros de privacidade | pending | 3 | 1, 2 |
| 6 | Implementar GET /api/v1/users/me/profile (perfil completo) | pending | 1.5 | 5 |
| 7 | Implementar PATCH /api/v1/users/me/profile com validacao Zod | pending | 2.5 | 1 |
| 8 | Implementar GET /api/v1/users/check-username/:username | pending | 1 | 1 |
| 9 | Implementar POST /api/v1/users/me/avatar/presign (gerar URL R2) | pending | 2 | 3 |
| 10 | Implementar PATCH /api/v1/users/me/avatar/confirm (processar com sharp) | pending | 2.5 | 4, 9 |
| 11 | Implementar DELETE /api/v1/users/me/avatar | pending | 1 | 3 |
| 12 | Implementar PATCH /api/v1/users/me/privacy | pending | 1.5 | 1 |

### Frontend - Componentes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 13 | Criar componente ProfileHeader (avatar, nome, username, bio) | pending | 2.5 | 5 |
| 14 | Criar componente ProfileStats (tiragens, seguidores, seguindo) | pending | 1.5 | 5 |
| 15 | Criar componente ProfileAstrology (signo, arcano, kin) | pending | 2 | 5 |
| 16 | Criar componente ProfileEditForm com auto-save | pending | 3 | 7 |
| 17 | Criar componente de upload de avatar com preview e drag-and-drop | pending | 3 | 9, 10 |
| 18 | Criar componente PrivacySettings com toggles | pending | 2 | 12 |
| 19 | Criar pagina de perfil publico /perfil/:username | pending | 2 | 13, 14, 15 |
| 20 | Configurar TanStack Query hooks para perfil | pending | 1.5 | 5, 6 |

### Calculos Automaticos

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 21 | Implementar calculo de signo solar (funcao utilitaria) | pending | 1 | - |
| 22 | Integrar calculo de arcano pessoal (reutilizar logica de SPEC-005) | pending | 1.5 | 21 |
| 23 | Integrar calculo de Kin Maya (reutilizar logica de SPEC-006) | pending | 1.5 | 21 |

### Testes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|---|
| 24 | Criar testes de integracao para endpoints de perfil | pending | 2 | 5-12 |
| 25 | Criar testes E2E de fluxo de edicao de perfil | pending | 3 | 16, 17 |
| 26 | Criar testes de privacidade (acesso negado conforme configuracao) | pending | 2 | 18 |

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