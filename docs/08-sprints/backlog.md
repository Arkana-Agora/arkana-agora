# Backlog Arkana Agora

> **Projeto**: Arkana Agora  
> **Identificador**: `arkana-agora`  
> **Última atualização**: Planejamento inicial  
> **Total de itens**: 48 user stories

---

## Legenda

| Prioridade | Descrição |
|-----------|----------|
| Crítica | Bloqueia o MVP, deve ser feita primeiro |
| Alta | Essencial para a versão, mas não bloqueia outras features |
| Média | Importante, pode ser adiada se necessário |
| Baixa | Nice-to-have, planejada para versões futuras |

---

## Sprint 0 — Infraestrutura (Prioridade: Crítica)

| ID | User Story | Prioridade | Estimativa | Versão |
|----|-----------|-----------|-----------|--------|
| B-001 | Setup monorepo Turborepo + pnpm | Crítica | 3d | MVP |
| B-002 | Docker Compose stack completa | Crítica | 2d | MVP |
| B-003 | CI/CD GitHub Actions | Crítica | 2d | MVP |
| B-004 | Prisma + PostgreSQL setup | Crítica | 2d | MVP |
| B-005 | Auth.js v5 (Google OAuth + magic link) — entregue (F2A/M0, ADR-010) | Crítica | 3d | MVP |
| B-006 | Design system shadcn/ui — entregue (F2B) | Alta | 5d | MVP |
| B-007 | Sentry error tracking | Média | 1d | MVP |
| B-008 | PostHog analytics | Média | 1d | MVP |

**Subtotal**: 8 itens | **19 dias úteis**

---

## Sprint 1 — MVP Core (Prioridade: Crítica)

| ID | User Story | Prioridade | Estimativa | Versão |
|----|-----------|-----------|-----------|--------|
| B-009 | Cadastro/Login social (magic link + Google OAuth já entregues no Sprint 0/F2A, ADR-010) | Crítica | 2d | MVP |
| B-009A | Custom JWT Layer: access RS256 (15 min) + refresh rotation (30 dias) + revogação (`tokenVersion`) | Crítica | 3d | MVP |
| B-009B | Rate limit do magic link (RF-AUTH-003: 3 links/hora) via `/api/v1/auth/magic-link` | Alta | 1d | MVP |
| B-009C | Credentials e-mail/senha + Facebook OAuth (Sprint 1, ADR-010 §10) | Alta | 2d | MVP |
| B-009D | Model `Account` + backfill `provider`/`providerId` (multi-provedor, ADR-010 §5) | Média | 2d | MVP |
| B-010 | Perfil do usuário | Crítica | 3d | MVP |
| B-011 | Motor de tiragem de tarot | Crítica | 5d | MVP |
| B-012 | Tarot do dia | Alta | 2d | MVP |
| B-013 | Leitura IA (SSE streaming) | Crítica | 5d | MVP |
| B-014 | Arcano Pessoal (Pitágoras) | Alta | 3d | MVP |
| B-015 | Histórico de tiragens | Média | 2d | MVP |
| B-016 | PWA + mobile responsive | Alta | 5d | MVP |
| B-017 | Landing page completa | Alta | 3d | MVP |
| B-018 | Seed data (baralhos) | Média | 1d | MVP |

**Subtotal**: 14 itens | **44 dias úteis**

---

## Sprint 2 — Social + Horóscopos (Prioridade: Alta)

| ID | User Story | Prioridade | Estimativa | Versão |
|----|-----------|-----------|-----------|--------|
| B-019 | Sistema de follow | Alta | 3d | V1 |
| B-020 | Feed social | Alta | 5d | V1 |
| B-021 | Posts + compartilhamento | Alta | 3d | V1 |
| B-022 | Likes e comentários | Média | 3d | V1 |
| B-023 | Horóscopo Ocidental | Alta | 2d | V1 |
| B-024 | Horóscopo Chinês | Alta | 3d | V1 |
| B-025 | Kin Maya + Horóscopo Maia | Alta | 4d | V1 |
| B-026 | Gifts virtuais | Média | 3d | V1 |
| B-027 | Notificações in-app | Média | 2d | V1 |
| B-028 | Baralho Cigano (Lenormand) | Alta | 4d | V1 |
| B-029 | Página explore | Média | 2d | V1 |

**Subtotal**: 11 itens | **34 dias úteis**

---

## Sprint 3 — Marketplace + Monetização (Prioridade: Alta)

| ID | User Story | Prioridade | Estimativa | Versão |
|----|-----------|-----------|-----------|--------|
| B-030 | Marketplace: listar produtos | Alta | 3d | V1 |
| B-031 | Mercado Pago: PIX + cartão | Crítica | 5d | V1 |
| B-032 | Assinatura Arkana Plus | Alta | 4d | V1 |
| B-033 | Perfil profissional | Média | 3d | V1 |
| B-034 | Sistema de avaliações | Média | 2d | V1 |
| B-035 | Admin dashboard | Média | 5d | V1 |
| B-036 | Dispute resolution | Baixa | 2d | V1 |
| B-037 | Relatórios financeiros | Baixa | 2d | V1 |

**Subtotal**: 8 itens | **26 dias úteis**

---

## Backlog Futuro (V2+)

| ID | User Story | Prioridade | Estimativa | Versão |
|----|-----------|-----------|-----------|--------|
| B-038 | Chat real-time (Socket.io) | Média | 5d | V2 |
| B-039 | Video call consultas | Baixa | 8d | V2 |
| B-040 | IA generativa avançada | Média | 5d | V2 |
| B-041 | Geração de artes IA para cartas | Média | 5d | V2 |
| B-042 | Academy: cursos online | Baixa | 10d | V2 |
| B-043 | Trade system (inventário) | Baixa | 5d | V2 |
| B-044 | Desktop app (Electron) | Baixa | 8d | V2 |
| B-045 | i18n: espanhol, inglês | Média | 5d | V2 |
| B-046 | Notificações push (mobile) | Média | 3d | V2 |
| B-047 | App nativo (React Native) | Alta | 20d | V2 |
| B-048 | Programas de afiliados | Baixa | 5d | V2 |

**Subtotal**: 11 itens | **79 dias úteis**

---

## Resumo por Versão

| Versão | Itens | Dias Estimados | Sprints |
|--------|-------|---------------|---------|
| MVP (Sprint 0 + 1) | 18 | 53d | 2 |
| V1 (Sprint 2 + 3) | 19 | 60d | 2 |
| V2 (Backlog Futuro) | 11 | 79d | 3-4 |
| **Total** | **48** | **192d** | **7-8 sprints** |

---

## Distribuição por Prioridade

| Prioridade | Quantidade | Percentual |
|-----------|-----------|------------|
| Crítica | 9 | 18,8% |
| Alta | 20 | 41,7% |
| Média | 12 | 25,0% |
| Baixa | 7 | 14,6% |

---

## Notas

- Estimativas em dias úteis (considerando 1 dev dedicado)
- Itens do backlog futuro podem ser repriorizados a cada sprint planning
- Novos itens podem ser adicionados conforme feedback dos usuários beta
- Dependências externas (Mercado Pago, Apple/Google) podem impactar cronograma
