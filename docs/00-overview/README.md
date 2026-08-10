# Arkana Agora -- Documentacao do Projeto

> Onde a intuicao encontra a tecnologia.

## Sobre este Repositorio

Este diretorio contem a **Documentacao de Design de Software (SDD)** completa para a plataforma **Arkana Agora**, organizada em modulos independentes.

## Estrutura

```
00-overview/    -> Visao geral, glossario, personas, roadmap
01-product/     -> Requisitos, regras de negocio, user stories, MVP
02-architecture/-> Arquitetura, ADRs, monorepo, deploy, observabilidade
03-database/    -> ERD, entidades, relacionamentos, migrations, indices
04-api/         -> Endpoints, autenticacao, API reference
05-ai/          -> Prompts, arquitetura IA, moderacao, custos
06-features/    -> Documentacao por funcionalidade
07-security/    -> LGPD, seguranca, permissoes, moderacao
08-sprints/     -> Sprints, backlog, milestones
```

## Especificacoes por Feature

O diretorio `.specs/` contem especificacoes independentes por modulo, prontas para workflow de desenvolvimento:

```
.specs/
  ├── 001-auth/
  ├── 002-profile/
  ├── 003-tarot-engine/
  ├── 004-ai-readings/
  ├── 005-arcana-personal/
  ├── 006-horoscopes/
  ├── 007-social/
  ├── 008-marketplace/
  ├── 009-payments/
  └── 010-admin/
```

## Convencoes

- **Marca**: Arkana Agora
- **Identificador tecnico**: `arkana-agora`
- **Idioma principal**: pt-BR
- **Versao do documento**: 1.0.0
