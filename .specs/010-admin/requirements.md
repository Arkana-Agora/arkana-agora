# SPEC-010: Painel Administrativo

**Plataforma**: Arkana Agora
**Versao**: MVP
**Status**: Pendente
**Data**: 2025-01-01

---

## 1. Visao Geral

Este documento define os requisitos do Painel Administrativo do Arkana Agora. O painel permite que a equipe de administracao gerencie usuarios, monitore metricas de negocio, modere conteudo e acompanhe a saude financeira e tecnica da plataforma.

---

## 2. Controle de Acesso (RBAC)

### Perfis de Acesso

**Admin:**
- Gerenciamento de usuarios (listar, suspender, reativar, excluir)
- Visualizacao de dashboard e relatorios
- Moderacao de conteudo (posts, comentarios, reviews)
- Resolucao de disputas do marketplace
- Visualizacao de dados financeiros
- Gerenciamento de categorias do marketplace
- Envio de notificacoes push em massa

**SuperAdmin:**
- Todas as permissoes de Admin
- Gerenciamento de outros admins (criar, remover, alterar permissoes)
- Configuracao do sistema (feature flags, limites de plano, precos)
- Acesso a logs de seguranca e auditoria
- Exportacao de dados em CSV/JSON
- Acesso ao terminal de debug (somente em desenvolvimento)
- Gerenciamento de webhooks e integracoes

---

## 3. Requisitos Funcionais

### RF-ADM-001: Gerenciamento de Usuarios
O painel deve oferecer ferramentas completas para gerenciar usuarios:

**Listagem:**
- Tabela com colunas: ID, nome, email, plano, status, data de cadastro, ultima atividade
- Busca por nome, email ou ID
- Filtros: plano (Free, Plus), status (ativo, suspenso, deletado), data de cadastro
- Ordenacao por qualquer coluna
- Paginacao com 50 itens por pagina
- Exportacao filtrada em CSV

**Acoes em lote:**
- Suspender usuarios selecionados (motivo obrigatorio)
- Reativar usuarios suspensos
- Alterar plano manualmente
- Enviar notificacao para usuarios selecionados

**Detalhe do usuario:**
- Todas as informacoes do perfil
- Historico de logins (IP, user agent, data)
- Lista de tiragens
- Posts e comentarios
- Historico de pagamentos
- Acao: suspender, reativar, excluir permanentemente (hard delete com confirmacao)

### RF-ADM-002: Dashboard de Analytics
O painel deve exibir um dashboard com as metricas principais:

**Metricas de crescimento:**
- Total de usuarios cadastrados (com grafico de evolucao)
- Novos usuarios por periodo (hoje, 7 dias, 30 dias)
- Taxa de retencao (D1, D7, D30)
- Usuarios ativos diarios (DAU) e mensais (MAU)

**Metricas de engajamento:**
- Total de tiragens realizadas por periodo
- Media de tiragens por usuario
- Total de interpretacoes IA (com custo em tokens)
- Posts publicados, curtidas, comentarios

**Metricas de receita:**
- MRR (Monthly Recurring Revenue)
- Novas assinaturas Plus por periodo
- Churn rate (cancelamentos / total ativos)
- LTV estimado
- Receita do marketplace (comissao)

**Graficos:**
- Linha: evolucao de usuarios e receita (30 dias)
- Barra: tiragens por dia da semana
- Pizza: distribuicao por plano (Free vs Plus)
- Funil: cadastro -> verificacao -> primeira tiragem -> assinatura

### RF-ADM-003: Moderacao de Conteudo
O painel deve oferecer ferramentas de moderacao:

**Fila de moderacao:**
- Posts denuncados por usuarios (com motivo da denuncia)
- Comentarios denuncados
- Reviews denuncados
- Novos perfis profissionais aguardando verificacao

**Acoes:**
- Aprovar conteudo
- Rejeitar conteudo (motivo obrigatorio, notifica o autor)
- Excluir conteudo permanentemente
- Suspender usuario (com ou sem aviso previo)
- Marcar como revisado (sem acao)

**Denuncias:**
- Usuarios podem denunciar posts e comentarios
- Motivos: conteudo ofensivo, spam, assedio, conteudo inadequado, violacao de direitos autorais
- Contagem de denuncias exibida no card do conteudo
- Auto-moderacao: conteudo com 5+ denuncias e pausado automaticamente ate revisao

### RF-ADM-004: Relatorios Financeiros
O painel deve exibir dados financeiros detalhados:

**Visao geral:**
- Receita total por periodo (selecionavel: 7d, 30d, 90d, personalizado)
- Receita por tipo: assinaturas, marketplace, moedas
- Taxa de conversao Free -> Plus
- Taxa de reembolso
- Custos operacionais estimados (IA tokens, infraestrutura)

**Detalhamento:**
- Lista de transacoes com filtros (data, status, metodo, plano)
- Reembolsos solicitados e processados
- Comissao do marketplace por vendedor
- Exportacao em CSV para importacao em planilhas

### RF-ADM-005: Saude do Sistema
O painel deve exibir indicadores de saude tecnica:

**Infraestrutura:**
- Uptime da aplicacao (ultimo 30 dias)
- Tempo medio de resposta das APIs (P50, P95, P99)
- Taxa de erros 5xx (ultimo 24h)
- Uso de CPU e memoria do servidor
- Espaco em disco utilizado

**Integracoes:**
- Status da conexao com Mercado Pago (webhook recebido recentemente?)
- Status do servico Socket.io (usuarios conectados)
- Status do servico de IA (latencia, erros)
- Status do Cloudflare R2 (espaco utilizado)

**Jobs agendados:**
- Lista de cron jobs com ultimo horario de execucao e status
- Horoscopo diario (04:00 BRT)
- Verificacao de assinaturas vencidas
- Limpeza de sessions expiradas
- Delecao definitiva de contas apos carencia LGPD

---

## 4. Requisitos Nao Funcionais

### RNF-ADM-001: Tempo de Carregamento do Dashboard
O dashboard principal deve carregar em menos de 2 segundos (P95), incluindo todas as metricas e graficos. Dados devem ser pre-agregados via cron job (materialized view ou tabela de metricas).

### RNF-ADM-002: Auditoria
Todas as acoes administrativas (suspensao, exclusao, alteracao de plano, moderacao) devem ser registradas em log de auditoria com: adminId, acao, targetId, timestamp, detalhes.

---

## 5. Dependencias

| Dependencia | Versao | Proposito |
---|---|---|
| TanStack Table | >=8.x | Tabelas de dados com ordenacao e filtros |
| Recharts | >=2.x | Graficos de dashboard |
| date-fns | >=3.x | Formatacao de datas |
| Zod | >=3.x | Validacao |

---

## 6. Criterios de Aceite

| ID | Criterio | Metodo de Validacao |
---|---|---|
| CA-ADM-001 | Um admin consegue listar usuarios, suspender um usuario e o usuario suspenso nao consegue fazer login | Teste E2E |
| CA-ADM-002 | O dashboard exibe metricas de usuarios, receita e engajamento com dados reais | Teste de integracao |
| CA-ADM-003 | Um admin aprova um perfil profissional e o badge de verificado aparece no perfil | Teste E2E |
| CA-ADM-004 | O log de auditoria registra todas as acoes com admin, acao, alvo e timestamp | Verificacao de banco |
| CA-ADM-005 | A lista de jobs agendados exibe o status correto da ultima execucao | Teste de integracao |